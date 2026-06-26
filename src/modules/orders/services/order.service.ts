import { randomInt } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { PaginationMeta } from '../../../common/interfaces/api-response.interface';
import { buildPaginationMeta } from '../../../common/utils/pagination.util';
import { AuditAction, AuditService } from '../../audit';
import { CartService } from '../../cart';
import { VariantService } from '../../catalog';
import { InventoryService } from '../../inventory';
import { NotificationEvent, NotificationService } from '../../notifications';
import { PromotionsService } from '../../promotions';
import { AddressSnapshot, UsersService } from '../../users';
import { AddressInputDto } from '../dto/address-input.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderQueryDto } from '../dto/order-query.dto';
import { OrderResponseDto } from '../dto/order-response.dto';
import { Order } from '../entities/order.entity';
import { OrderAddress } from '../entities/order-address.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { OrderAddressType } from '../enums/order-address-type.enum';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import {
  canTransition,
  CUSTOMER_CANCELLABLE,
  ORDERS_STAFF_ROLES,
  ORDER_NUMBER_PREFIX,
  RETURN_FLOW_STATUSES,
  STAFF_CANCELLABLE,
} from '../orders.constants';
import { OrderRepository } from '../repositories/order.repository';

interface PricedLine {
  variantId: string;
  productId: string;
  sku: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly cartService: CartService,
    private readonly variantService: VariantService,
    private readonly inventoryService: InventoryService,
    private readonly usersService: UsersService,
    private readonly promotionsService: PromotionsService,
    private readonly notifications: NotificationService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  // --- checkout --------------------------------------------------------------

  /**
   * Convert the user's ACTIVE cart into an order: revalidate sellability, lock
   * prices at checkout (edge #8), reserve stock atomically (edge #1), snapshot
   * addresses, then persist PENDING and mark the cart CONVERTED.
   */
  async checkout(
    user: AuthenticatedUser,
    dto: CreateOrderDto,
    ip: string | null,
  ): Promise<OrderResponseDto> {
    const cart = await this.cartService.getActiveCart(user.id);
    if (!cart || cart.lines.length === 0) {
      throw new UnprocessableEntityException('Your cart is empty');
    }

    const availability = await this.inventoryService.getBulkAvailability(
      cart.lines.map((line) => line.variantId),
    );
    const availableByVariant = new Map(
      availability.map((a) => [a.variantId, a.available]),
    );

    // Active flash-sale prices overlaid on the catalog price (lock the lower,
    // edge #8) at the binding moment.
    const flashPrices = await this.promotionsService.getActiveFlashPrices(
      cart.lines.map((line) => line.variantId),
    );

    // Revalidate + lock price for every line before touching the database.
    const pricedLines: PricedLine[] = [];
    let currency = cart.currency;
    for (const line of cart.lines) {
      const info = await this.variantService.getVariantSaleInfo(line.variantId);
      if (!info || !info.sellable) {
        throw new UnprocessableEntityException(
          `An item in your cart (${line.variantId}) is no longer available`,
        );
      }
      const available = availableByVariant.get(line.variantId) ?? 0;
      if (available < line.quantity) {
        throw new ConflictException(
          `Insufficient stock for "${info.productName}" (${available} available, ${line.quantity} requested)`,
        );
      }
      currency = info.currency;
      const flash = flashPrices.get(line.variantId);
      const unitPrice =
        flash != null && flash < info.unitPrice ? flash : info.unitPrice;
      pricedLines.push({
        variantId: info.variantId,
        productId: info.productId,
        sku: info.sku,
        productName: info.productName,
        unitPrice,
        quantity: line.quantity,
        lineTotal: round2(unitPrice * line.quantity),
      });
    }

    const subtotal = round2(
      pricedLines.reduce((sum, l) => sum + l.lineTotal, 0),
    );
    // Apply the cart's coupon (validated again here; throws if no longer valid).
    let discountTotal = 0;
    const couponCode = cart.couponCode;
    if (couponCode) {
      const quote = await this.promotionsService.quoteCoupon({
        code: couponCode,
        userId: user.id,
        ip,
        lines: pricedLines.map((l) => ({
          productId: l.productId,
          lineTotal: l.lineTotal,
        })),
        subtotal,
      });
      discountTotal = quote.discountAmount;
    }
    const shippingTotal = 0;
    const taxTotal = 0;
    const grandTotal = round2(
      subtotal - discountTotal + shippingTotal + taxTotal,
    );

    const shipping = await this.resolveAddress(
      user.id,
      dto.shippingAddressId,
      dto.shippingAddress,
      'shipping',
    );
    const billing =
      dto.billingAddressId || dto.billingAddress
        ? await this.resolveAddress(
            user.id,
            dto.billingAddressId,
            dto.billingAddress,
            'billing',
          )
        : { ...shipping };

    const orderNumber = await this.generateOrderNumber();

    const order = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Order, {
          orderNumber,
          userId: user.id,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          currency,
          subtotal,
          discountTotal,
          shippingTotal,
          taxTotal,
          grandTotal,
          couponCode: cart.couponCode,
          placedAt: new Date(),
          createdBy: user.id,
          updatedBy: user.id,
        }),
      );
      for (const line of pricedLines) {
        await manager.save(
          manager.create(OrderItem, {
            orderId: saved.id,
            variantId: line.variantId,
            productId: line.productId,
            skuSnapshot: line.sku,
            productNameSnapshot: line.productName,
            variantLabelSnapshot: null,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
          }),
        );
      }
      await manager.save(
        manager.create(OrderAddress, {
          orderId: saved.id,
          type: OrderAddressType.SHIPPING,
          ...shipping,
        }),
      );
      await manager.save(
        manager.create(OrderAddress, {
          orderId: saved.id,
          type: OrderAddressType.BILLING,
          ...billing,
        }),
      );
      await manager.save(
        manager.create(OrderStatusHistory, {
          orderId: saved.id,
          fromStatus: null,
          toStatus: OrderStatus.PENDING,
          note: 'Order placed',
          changedBy: user.id,
        }),
      );
      return saved;
    });

    // Reserve stock as a saga step. All-or-nothing; on failure compensate by
    // cancelling the just-created order (no stock is held).
    try {
      await this.inventoryService.reserveMany(
        {
          orderId: order.id,
          items: pricedLines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
          })),
        },
        user.id,
      );
    } catch (err) {
      await this.compensateFailedReservation(order, user.id);
      throw err;
    }

    await this.cartService.markConverted(cart.id);

    void this.auditService.record({
      action: AuditAction.ORDER_CREATED,
      actorId: user.id,
      targetType: 'order',
      targetId: order.id,
      ip,
      metadata: { orderNumber, grandTotal, currency },
    });

    return this.getOrderResponse(order.id);
  }

  // --- reads -----------------------------------------------------------------

  async list(
    user: AuthenticatedUser,
    query: OrderQueryDto,
  ): Promise<{ data: OrderResponseDto[]; pagination: PaginationMeta }> {
    const staff = this.isStaff(user);
    const filter: { userId?: string; status?: OrderStatus } = {
      status: query.status,
    };
    // Customers always see only their own orders; staff see all only with ?all=true.
    if (!staff || !query.all) {
      filter.userId = user.id;
    }
    const [rows, total] = await this.orderRepository.list(
      query.skip,
      query.limit,
      filter,
    );
    return {
      data: rows.map((order) => OrderResponseDto.fromEntity(order)),
      pagination: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  async getById(
    user: AuthenticatedUser,
    orderId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findDetail(orderId);
    if (!order || !this.canView(user, order)) {
      // 404 (not 403) so we never reveal another user's order ids.
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    return OrderResponseDto.fromEntity(order);
  }

  // --- lifecycle -------------------------------------------------------------

  /** Staff: drive a fulfilment transition (PENDING..DELIVERED, or CANCELLED). */
  async updateStatus(
    user: AuthenticatedUser,
    orderId: string,
    toStatus: OrderStatus,
    note: string | null,
    ip: string | null,
  ): Promise<OrderResponseDto> {
    if (RETURN_FLOW_STATUSES.has(toStatus)) {
      throw new BadRequestException(
        'Return/refund transitions are driven via the returns endpoints',
      );
    }
    const order = await this.requireOrder(orderId);
    if (!canTransition(order.status, toStatus)) {
      throw new ConflictException(
        `Cannot move order from ${order.status} to ${toStatus}`,
      );
    }
    return this.runTransition(order, toStatus, user.id, note, ip);
  }

  /**
   * Confirm payment for an order: deduct reserved stock and set PAID. The seam
   * the Payments module (Phase 6) calls from a successful gateway callback.
   */
  async markPaid(
    orderId: string,
    actorId: string | null,
  ): Promise<OrderResponseDto> {
    const order = await this.requireOrder(orderId);
    if (order.status === OrderStatus.PAID) {
      return this.getOrderResponse(order.id); // idempotent
    }
    if (!canTransition(order.status, OrderStatus.PAID)) {
      throw new ConflictException(
        `Order ${order.status} cannot be marked paid`,
      );
    }
    return this.runTransition(
      order,
      OrderStatus.PAID,
      actorId,
      'Payment confirmed',
      null,
    );
  }

  /** Owner (pre-payment) or staff (pre-shipment) cancels an order. */
  async cancel(
    user: AuthenticatedUser,
    orderId: string,
    reason: string | null,
    ip: string | null,
  ): Promise<OrderResponseDto> {
    const order = await this.requireOrder(orderId);
    const staff = this.isStaff(user);
    if (!staff && order.userId !== user.id) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    const cancellable = staff ? STAFF_CANCELLABLE : CUSTOMER_CANCELLABLE;
    if (!cancellable.has(order.status)) {
      throw new ConflictException(
        `Order in status ${order.status} can no longer be cancelled`,
      );
    }
    return this.runTransition(
      order,
      OrderStatus.CANCELLED,
      user.id,
      reason ?? 'Order cancelled',
      ip,
    );
  }

  /**
   * Used by the returns flow (same module) to move an order along the
   * return/refund branch with a transactional history row.
   */
  async applyReturnTransition(
    orderId: string,
    toStatus: OrderStatus,
    paymentStatus: PaymentStatus | null,
    actorId: string | null,
    note: string | null,
  ): Promise<void> {
    const order = await this.requireOrder(orderId);
    if (!canTransition(order.status, toStatus)) {
      throw new ConflictException(
        `Cannot move order from ${order.status} to ${toStatus}`,
      );
    }
    await this.persistTransition(order, toStatus, paymentStatus, actorId, note);
  }

  // --- reviews seam (reviews → orders, one-way) ------------------------------

  /**
   * The most recent order id by which the user actually purchased the product
   * (past-checkout status), or null. Drives the reviews verified-purchase flag.
   */
  findPurchasedOrderId(
    userId: string,
    productId: string,
  ): Promise<string | null> {
    return this.orderRepository.findPurchasedOrderId(userId, productId);
  }

  // --- payments seams (payments → orders, one-way) ---------------------------

  /** Payment view of an order: validates ownership + that it's still payable. */
  async getPayableOrder(
    orderId: string,
    userId: string,
  ): Promise<{
    id: string;
    userId: string | null;
    grandTotal: number;
    currency: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
  }> {
    const order = await this.orderRepository.findById(orderId);
    if (!order || order.userId !== userId) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException(
        `Order ${order.status} is not awaiting payment`,
      );
    }
    if (order.paymentStatus !== PaymentStatus.UNPAID) {
      throw new ConflictException('Order is already paid');
    }
    return {
      id: order.id,
      userId: order.userId,
      grandTotal: order.grandTotal,
      currency: order.currency,
      status: order.status,
      paymentStatus: order.paymentStatus,
    };
  }

  /**
   * COD confirmation (D34): deduct reserved stock and move PENDING→CONFIRMED,
   * leaving paymentStatus UNPAID (cash is collected on delivery).
   */
  async confirmOrder(
    orderId: string,
    actorId: string | null,
  ): Promise<OrderResponseDto> {
    const order = await this.requireOrder(orderId);
    if (order.status === OrderStatus.CONFIRMED) {
      return this.getOrderResponse(order.id); // idempotent
    }
    if (!canTransition(order.status, OrderStatus.CONFIRMED)) {
      throw new ConflictException(`Order ${order.status} cannot be confirmed`);
    }
    await this.inventoryService.confirmReservationsForOrder(order.id, actorId);
    await this.persistTransition(
      order,
      OrderStatus.CONFIRMED,
      null,
      actorId,
      'Order confirmed (COD)',
    );
    await this.recordPromotionRedemption(order);
    // COD confirmation is the customer's "order placed/confirmed" milestone.
    void this.notifyOrderEvent(order, NotificationEvent.ORDER_PAID);
    return this.getOrderResponse(order.id);
  }

  /**
   * Record that money was captured for an order without changing its fulfilment
   * status (e.g. COD collected on delivery). Idempotent.
   */
  async recordPaymentCaptured(
    orderId: string,
    actorId: string | null,
  ): Promise<void> {
    const order = await this.requireOrder(orderId);
    if (order.paymentStatus === PaymentStatus.PAID) return;
    order.paymentStatus = PaymentStatus.PAID;
    order.updatedBy = actorId;
    await this.orderRepository.save(order);
  }

  /**
   * Reconcile an order's payment_status after a gateway refund (D36). Full
   * refund → REFUNDED; partial → PARTIALLY_REFUNDED. Idempotent.
   */
  async applyRefund(
    orderId: string,
    refundedAmount: number,
    actorId: string | null,
  ): Promise<void> {
    const order = await this.requireOrder(orderId);
    order.paymentStatus =
      refundedAmount >= order.grandTotal
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;
    order.updatedBy = actorId;
    await this.orderRepository.save(order);
  }

  // --- internals -------------------------------------------------------------

  /** Apply a transition's stock side-effects, then persist status + history. */
  private async runTransition(
    order: Order,
    toStatus: OrderStatus,
    actorId: string | null,
    note: string | null,
    ip: string | null,
  ): Promise<OrderResponseDto> {
    let paymentStatus: PaymentStatus | null = null;

    if (toStatus === OrderStatus.PAID) {
      await this.inventoryService.confirmReservationsForOrder(
        order.id,
        actorId,
      );
      paymentStatus = PaymentStatus.PAID;
    } else if (toStatus === OrderStatus.CANCELLED) {
      paymentStatus = await this.applyCancellationStock(order, actorId);
    }

    await this.persistTransition(order, toStatus, paymentStatus, actorId, note);

    void this.auditService.record({
      action:
        toStatus === OrderStatus.CANCELLED
          ? AuditAction.ORDER_CANCELLED
          : AuditAction.ORDER_STATUS_CHANGED,
      actorId,
      targetType: 'order',
      targetId: order.id,
      ip,
      metadata: { toStatus },
    });

    // Online payment commit: consume the coupon + advance flash sold counts (D40).
    if (toStatus === OrderStatus.PAID) {
      await this.recordPromotionRedemption(order);
    }

    // Best-effort customer notification for the milestone (Phase 10).
    if (toStatus === OrderStatus.PAID) {
      void this.notifyOrderEvent(order, NotificationEvent.ORDER_PAID);
    } else if (toStatus === OrderStatus.SHIPPED) {
      void this.notifyOrderEvent(order, NotificationEvent.ORDER_SHIPPED);
    } else if (toStatus === OrderStatus.DELIVERED) {
      void this.notifyOrderEvent(order, NotificationEvent.ORDER_DELIVERED);
    }

    return this.getOrderResponse(order.id);
  }

  /**
   * Best-effort customer notification for an order lifecycle milestone (D59).
   * Resolves the buyer's contact via the users seam (D64) and dispatches through
   * the notifications pipeline; never throws into the order transaction.
   */
  private async notifyOrderEvent(
    order: Order,
    event: NotificationEvent,
  ): Promise<void> {
    if (!order.userId) return;
    try {
      const contact = await this.usersService.getContactInfo(order.userId);
      await this.notifications.dispatch({
        event,
        userId: order.userId,
        to: { email: contact.email, phone: contact.phone },
        data: {
          orderNumber: order.orderNumber,
          amount: order.grandTotal,
          currency: order.currency,
        },
      });
    } catch (err) {
      this.logger.error(
        `Order ${order.id} notification ${event} failed: ${String(err)}`,
      );
    }
  }

  /** Record coupon redemption + flash sold counts when an order commits (best-effort). */
  private async recordPromotionRedemption(order: Order): Promise<void> {
    try {
      await this.promotionsService.redeemForOrder({
        orderId: order.id,
        userId: order.userId,
        code: order.couponCode,
        discountAmount: order.discountTotal,
        variantIds: (order.items ?? []).map((item) => item.variantId),
      });
    } catch (err) {
      this.logger.error(
        `Promotion redemption failed for order ${order.id}: ${String(err)}`,
      );
    }
  }

  /**
   * On cancel, key off the order STATUS (not paymentStatus) to decide stock
   * handling: while PENDING the stock is only HELD → release the reservation;
   * once committed (CONFIRMED for COD, PAID for online, or beyond) the stock was
   * already deducted → return it to inventory. A refund is flagged only when
   * money was actually captured (paymentStatus PAID); the gateway settlement is
   * a staff-initiated `POST /payments/refund` (Phase 6, D36).
   */
  private async applyCancellationStock(
    order: Order,
    actorId: string | null,
  ): Promise<PaymentStatus | null> {
    if (order.status === OrderStatus.PENDING) {
      await this.inventoryService.releaseReservationsForOrder(
        order.id,
        actorId,
      );
      return null;
    }
    for (const item of order.items ?? []) {
      await this.inventoryService.returnToStock(
        item.variantId,
        item.quantity,
        order.id,
        actorId,
      );
    }
    return order.paymentStatus === PaymentStatus.PAID
      ? PaymentStatus.REFUNDED
      : null;
  }

  private persistTransition(
    order: Order,
    toStatus: OrderStatus,
    paymentStatus: PaymentStatus | null,
    actorId: string | null,
    note: string | null,
  ): Promise<void> {
    const fromStatus = order.status;
    return this.dataSource.transaction(async (manager) => {
      order.status = toStatus;
      if (paymentStatus) order.paymentStatus = paymentStatus;
      order.updatedBy = actorId;
      await manager.save(order);
      await manager.save(
        manager.create(OrderStatusHistory, {
          orderId: order.id,
          fromStatus,
          toStatus,
          note,
          changedBy: actorId,
        }),
      );
    });
  }

  private async compensateFailedReservation(
    order: Order,
    actorId: string | null,
  ): Promise<void> {
    try {
      await this.persistTransition(
        order,
        OrderStatus.CANCELLED,
        null,
        actorId,
        'Auto-cancelled: stock unavailable at reservation',
      );
    } catch (err) {
      this.logger.error(
        `Failed to compensate order ${order.id} after reservation failure: ${String(err)}`,
      );
    }
  }

  private async resolveAddress(
    userId: string,
    addressId: string | undefined,
    inline: AddressInputDto | undefined,
    kind: 'shipping' | 'billing',
  ): Promise<AddressSnapshot> {
    if (addressId) {
      return this.usersService.getAddressSnapshot(userId, addressId);
    }
    if (inline) {
      return {
        recipientName: inline.recipientName,
        phone: inline.phone,
        line1: inline.line1,
        line2: inline.line2 ?? null,
        city: inline.city,
        state: inline.state ?? null,
        postalCode: inline.postalCode ?? null,
        country: inline.country ?? 'BD',
      };
    }
    throw new BadRequestException(
      `A ${kind} address is required: provide ${kind}AddressId or ${kind}Address`,
    );
  }

  private async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let attempt = 0; attempt < 8; attempt++) {
      let suffix = '';
      for (let i = 0; i < 6; i++) {
        suffix += alphabet[randomInt(alphabet.length)];
      }
      const candidate = `${ORDER_NUMBER_PREFIX}-${datePart}-${suffix}`;
      if (!(await this.orderRepository.orderNumberExists(candidate))) {
        return candidate;
      }
    }
    throw new ConflictException('Could not allocate a unique order number');
  }

  private async requireOrder(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findWithItems(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return order;
  }

  private async getOrderResponse(orderId: string): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findDetail(orderId);
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return OrderResponseDto.fromEntity(order);
  }

  private isStaff(user: AuthenticatedUser): boolean {
    return user.roles.some((role) =>
      (ORDERS_STAFF_ROLES as readonly string[]).includes(role),
    );
  }

  private canView(user: AuthenticatedUser, order: Order): boolean {
    return this.isStaff(user) || order.userId === user.id;
  }
}
