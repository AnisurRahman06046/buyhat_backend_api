import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { AuditAction, AuditService } from '../../audit';
import { InventoryService } from '../../inventory';
import { CreateReturnDto } from '../dto/create-return.dto';
import { ReturnResponseDto } from '../dto/return-response.dto';
import { UpdateReturnDto } from '../dto/update-return.dto';
import { OrderReturn } from '../entities/order-return.entity';
import { OrderReturnItem } from '../entities/order-return-item.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { ReturnStatus } from '../enums/return-status.enum';
import { ORDERS_STAFF_ROLES, RETURN_TRANSITIONS } from '../orders.constants';
import { OrderRepository } from '../repositories/order.repository';
import { OrderReturnRepository } from '../repositories/order-return.repository';
import { OrderService } from './order.service';

@Injectable()
export class OrderReturnService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly returnRepository: OrderReturnRepository,
    private readonly orderService: OrderService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /** Customer (owner) requests a return for one or more lines of a delivered order. */
  async requestReturn(
    user: AuthenticatedUser,
    orderId: string,
    dto: CreateReturnDto,
    ip: string | null,
  ): Promise<ReturnResponseDto> {
    const order = await this.orderRepository.findDetail(orderId);
    if (!order || (!this.isStaff(user) && order.userId !== user.id)) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new ConflictException(
        `Only delivered orders can be returned (order is ${order.status})`,
      );
    }

    const itemsById = new Map((order.items ?? []).map((i) => [i.id, i]));
    const alreadyReturned = await this.returnRepository.returnedQuantities(
      order.id,
    );
    for (const line of dto.items) {
      const orderItem = itemsById.get(line.orderItemId);
      if (!orderItem) {
        throw new BadRequestException(
          `Order item ${line.orderItemId} is not part of this order`,
        );
      }
      const remaining =
        orderItem.quantity - (alreadyReturned.get(orderItem.id) ?? 0);
      if (line.quantity > remaining) {
        throw new ConflictException(
          `Cannot return ${line.quantity} of "${orderItem.productNameSnapshot}"; only ${remaining} remaining`,
        );
      }
    }

    const orderReturn = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(OrderReturn, {
          orderId: order.id,
          status: ReturnStatus.REQUESTED,
          reason: dto.reason ?? null,
          requestedBy: user.id,
        }),
      );
      for (const line of dto.items) {
        await manager.save(
          manager.create(OrderReturnItem, {
            returnId: saved.id,
            orderItemId: line.orderItemId,
            quantity: line.quantity,
          }),
        );
      }
      return saved;
    });

    await this.orderService.applyReturnTransition(
      order.id,
      OrderStatus.RETURN_REQUESTED,
      null,
      user.id,
      'Return requested',
    );

    void this.auditService.record({
      action: AuditAction.ORDER_RETURN_REQUESTED,
      actorId: user.id,
      targetType: 'order',
      targetId: order.id,
      ip,
      metadata: { returnId: orderReturn.id },
    });

    return this.getReturn(orderReturn.id);
  }

  async listForOrder(
    user: AuthenticatedUser,
    orderId: string,
  ): Promise<ReturnResponseDto[]> {
    const order = await this.orderRepository.findById(orderId);
    if (!order || (!this.isStaff(user) && order.userId !== user.id)) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    const returns = await this.returnRepository.findByOrder(orderId);
    return returns.map((r) => ReturnResponseDto.fromEntity(r));
  }

  /** Staff: advance a return (APPROVED | REJECTED | RECEIVED). */
  async updateReturn(
    user: AuthenticatedUser,
    returnId: string,
    dto: UpdateReturnDto,
    ip: string | null,
  ): Promise<ReturnResponseDto> {
    const orderReturn = await this.returnRepository.findDetail(returnId);
    if (!orderReturn) {
      throw new NotFoundException(`Return ${returnId} not found`);
    }
    const target = dto.status;
    if (!RETURN_TRANSITIONS[orderReturn.status]?.includes(target)) {
      throw new ConflictException(
        `Cannot move return from ${orderReturn.status} to ${target}`,
      );
    }

    switch (target) {
      case ReturnStatus.APPROVED:
        await this.setReturnStatus(orderReturn, ReturnStatus.APPROVED);
        break;
      case ReturnStatus.REJECTED:
        await this.setReturnStatus(orderReturn, ReturnStatus.REJECTED);
        // Return the order to DELIVERED so other items can still be returned.
        await this.orderService.applyReturnTransition(
          orderReturn.orderId,
          OrderStatus.DELIVERED,
          null,
          user.id,
          dto.note ?? 'Return rejected',
        );
        break;
      case ReturnStatus.RECEIVED:
        await this.handleReceived(orderReturn, user.id, ip);
        break;
      default:
        throw new BadRequestException(`Unsupported return status ${target}`);
    }

    return this.getReturn(returnId);
  }

  async getReturn(returnId: string): Promise<ReturnResponseDto> {
    const orderReturn = await this.returnRepository.findDetail(returnId);
    if (!orderReturn) {
      throw new NotFoundException(`Return ${returnId} not found`);
    }
    return ReturnResponseDto.fromEntity(orderReturn);
  }

  /**
   * Receive a return: post RETURN stock movements back into inventory (edge #9),
   * then move the order toward RETURNED/REFUNDED (full) or back to DELIVERED with
   * a PARTIALLY_REFUNDED flag (partial). Monetary settlement is Phase 6.
   */
  private async handleReceived(
    orderReturn: OrderReturn,
    actorId: string,
    ip: string | null,
  ): Promise<void> {
    const order = await this.orderRepository.findWithItems(orderReturn.orderId);
    if (!order) {
      throw new NotFoundException(`Order ${orderReturn.orderId} not found`);
    }
    const orderItemsById = new Map((order.items ?? []).map((i) => [i.id, i]));

    for (const item of orderReturn.items ?? []) {
      const orderItem = orderItemsById.get(item.orderItemId);
      if (orderItem) {
        await this.inventoryService.returnToStock(
          orderItem.variantId,
          item.quantity,
          order.id,
          actorId,
        );
      }
    }

    await this.setReturnStatus(orderReturn, ReturnStatus.RECEIVED);

    // Now that this return counts as RECEIVED, decide full vs partial.
    const returnedByItem = await this.returnRepository.returnedQuantities(
      order.id,
    );
    const fullyReturned = (order.items ?? []).every(
      (orderItem) =>
        (returnedByItem.get(orderItem.id) ?? 0) >= orderItem.quantity,
    );

    if (fullyReturned) {
      await this.orderService.applyReturnTransition(
        order.id,
        OrderStatus.RETURNED,
        null,
        actorId,
        'Returned items received',
      );
      await this.orderService.applyReturnTransition(
        order.id,
        OrderStatus.REFUNDED,
        PaymentStatus.REFUNDED,
        actorId,
        'Refund issued',
      );
    } else {
      await this.orderService.applyReturnTransition(
        order.id,
        OrderStatus.DELIVERED,
        PaymentStatus.PARTIALLY_REFUNDED,
        actorId,
        'Partial return received and refunded',
      );
    }

    await this.setReturnStatus(orderReturn, ReturnStatus.REFUNDED);

    void this.auditService.record({
      action: AuditAction.ORDER_RETURNED,
      actorId,
      targetType: 'order',
      targetId: order.id,
      ip,
      metadata: { returnId: orderReturn.id, fullyReturned },
    });
  }

  private async setReturnStatus(
    orderReturn: OrderReturn,
    status: ReturnStatus,
  ): Promise<void> {
    orderReturn.status = status;
    await this.returnRepository.save(orderReturn);
  }

  private isStaff(user: AuthenticatedUser): boolean {
    return user.roles.some((role) =>
      (ORDERS_STAFF_ROLES as readonly string[]).includes(role),
    );
  }
}
