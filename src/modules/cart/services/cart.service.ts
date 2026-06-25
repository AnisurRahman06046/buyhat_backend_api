import { randomUUID } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { VariantService } from '../../catalog';
import { InventoryService } from '../../inventory';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { CartItemResponseDto, CartResponseDto } from '../dto/cart-response.dto';
import { Cart } from '../entities/cart.entity';
import { CartItem } from '../entities/cart-item.entity';
import { CartStatus } from '../enums/cart-status.enum';
import { CartRepository } from '../repositories/cart.repository';
import { CartItemRepository } from '../repositories/cart-item.repository';

/** Who the cart belongs to: a logged-in user or a guest (mutually exclusive). */
export interface CartIdentity {
  userId?: string | null;
  guestId?: string | null;
}

/** A cart line as orders needs it at checkout (re-prices via catalog itself). */
export interface CheckoutCartLine {
  variantId: string;
  productId: string;
  quantity: number;
}

/** Minimal active-cart view handed to the orders module for conversion. */
export interface CheckoutCart {
  id: string;
  currency: string;
  couponCode: string | null;
  lines: CheckoutCartLine[];
}

@Injectable()
export class CartService {
  private readonly maxQtyPerLine: number;

  constructor(
    private readonly cartRepository: CartRepository,
    private readonly itemRepository: CartItemRepository,
    private readonly variantService: VariantService,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.maxQtyPerLine = config.get<number>('cart.maxQtyPerLine') ?? 99;
  }

  /** Current cart (never creates one); empty view if none exists yet. */
  async getCart(identity: CartIdentity): Promise<CartResponseDto> {
    const cart = await this.resolveActiveCart(identity, false);
    if (!cart) return this.emptyResponse(identity.guestId ?? null);
    return this.buildResponse(cart);
  }

  /**
   * Cross-module (orders): the user's ACTIVE cart as a minimal checkout view,
   * or null. Orders converts this into an order — it never touches cart tables.
   */
  async getActiveCart(userId: string): Promise<CheckoutCart | null> {
    const active = await this.cartRepository.findActiveByUser(userId);
    if (!active) return null;
    const cart = await this.cartRepository.findWithItems(active.id);
    if (!cart) return null;
    return {
      id: cart.id,
      currency: cart.currency,
      couponCode: cart.couponCode,
      lines: (cart.items ?? []).map((item) => ({
        variantId: item.variantId,
        productId: item.productId,
        quantity: item.quantity,
      })),
    };
  }

  /** Cross-module (orders): mark a cart CONVERTED once its order is placed. */
  async markConverted(cartId: string): Promise<void> {
    const cart = await this.cartRepository.findById(cartId);
    if (!cart || cart.status !== CartStatus.ACTIVE) return;
    cart.status = CartStatus.CONVERTED;
    await this.cartRepository.save(cart);
  }

  async addItem(
    identity: CartIdentity,
    dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    const info = await this.variantService.getVariantSaleInfo(dto.variantId);
    if (!info) {
      throw new NotFoundException(`Variant ${dto.variantId} not found`);
    }
    if (!info.sellable) {
      throw new UnprocessableEntityException(
        `Variant ${dto.variantId} is not available for purchase`,
      );
    }
    const cart = await this.resolveActiveCart(identity, true);
    const existing = await this.itemRepository.findByCartAndVariant(
      cart!.id,
      dto.variantId,
    );
    if (existing) {
      existing.quantity = Math.min(
        existing.quantity + dto.quantity,
        this.maxQtyPerLine,
      );
      existing.unitPriceSnapshot = info.unitPrice;
      existing.productNameSnapshot = info.productName;
      await this.itemRepository.save(existing);
    } else {
      await this.itemRepository.save(
        this.itemRepository.create({
          cartId: cart!.id,
          variantId: info.variantId,
          productId: info.productId,
          quantity: Math.min(dto.quantity, this.maxQtyPerLine),
          unitPriceSnapshot: info.unitPrice,
          productNameSnapshot: info.productName,
        }),
      );
    }
    await this.touch(cart!);
    return this.buildResponseById(cart!.id, cart!.guestId);
  }

  async updateItem(
    identity: CartIdentity,
    itemId: string,
    quantity: number,
  ): Promise<CartResponseDto> {
    const cart = await this.requireActiveCart(identity);
    const item = await this.requireItem(cart, itemId);
    item.quantity = Math.min(quantity, this.maxQtyPerLine);
    await this.itemRepository.save(item);
    await this.touch(cart);
    return this.buildResponseById(cart.id, cart.guestId);
  }

  async removeItem(
    identity: CartIdentity,
    itemId: string,
  ): Promise<CartResponseDto> {
    const cart = await this.requireActiveCart(identity);
    const item = await this.requireItem(cart, itemId);
    await this.itemRepository.hardDelete(item.id);
    await this.touch(cart);
    return this.buildResponseById(cart.id, cart.guestId);
  }

  async clear(identity: CartIdentity): Promise<CartResponseDto> {
    const cart = await this.resolveActiveCart(identity, false);
    if (!cart) return this.emptyResponse(identity.guestId ?? null);
    await this.dataSource.getRepository(CartItem).delete({ cartId: cart.id });
    await this.touch(cart);
    return this.buildResponseById(cart.id, cart.guestId);
  }

  /** Fold a guest cart into the user's ACTIVE cart (D20: sum overlaps). */
  async merge(userId: string, guestId: string): Promise<CartResponseDto> {
    const mergedId = await this.dataSource.transaction(async (manager) => {
      const guestCart = await manager.findOne(Cart, {
        where: { guestId, status: CartStatus.ACTIVE },
        relations: { items: true },
      });
      let userCart = await manager.findOne(Cart, {
        where: { userId, status: CartStatus.ACTIVE },
        relations: { items: true },
      });
      if (!userCart) {
        userCart = await manager.save(
          manager.create(Cart, {
            userId,
            status: CartStatus.ACTIVE,
            currency: guestCart?.currency ?? 'BDT',
            lastActivityAt: new Date(),
          }),
        );
        userCart.items = [];
      }

      if (guestCart && guestCart.id !== userCart.id) {
        const byVariant = new Map(
          (userCart.items ?? []).map((i) => [i.variantId, i]),
        );
        for (const gi of guestCart.items ?? []) {
          const existing = byVariant.get(gi.variantId);
          if (existing) {
            existing.quantity = Math.min(
              existing.quantity + gi.quantity,
              this.maxQtyPerLine,
            );
            await manager.save(existing);
          } else {
            await manager.save(
              manager.create(CartItem, {
                cartId: userCart.id,
                variantId: gi.variantId,
                productId: gi.productId,
                quantity: Math.min(gi.quantity, this.maxQtyPerLine),
                unitPriceSnapshot: gi.unitPriceSnapshot,
                productNameSnapshot: gi.productNameSnapshot,
              }),
            );
          }
        }
        guestCart.status = CartStatus.MERGED;
        await manager.save(guestCart);
      }
      userCart.lastActivityAt = new Date();
      await manager.save(userCart);
      return userCart.id;
    });
    return this.buildResponseById(mergedId, null);
  }

  // --- helpers ---

  private async resolveActiveCart(
    identity: CartIdentity,
    create: boolean,
  ): Promise<Cart | null> {
    if (identity.userId) {
      const existing = await this.cartRepository.findActiveByUser(
        identity.userId,
      );
      if (existing || !create) return existing;
      return this.createCart({ userId: identity.userId });
    }
    if (identity.guestId) {
      const existing = await this.cartRepository.findActiveByGuest(
        identity.guestId,
      );
      if (existing || !create) return existing;
      return this.createCart({ guestId: identity.guestId });
    }
    if (!create) return null;
    return this.createCart({ guestId: randomUUID() });
  }

  private createCart(owner: {
    userId?: string;
    guestId?: string;
  }): Promise<Cart> {
    return this.cartRepository.save(
      this.cartRepository.create({
        userId: owner.userId ?? null,
        guestId: owner.guestId ?? null,
        status: CartStatus.ACTIVE,
        currency: 'BDT',
        lastActivityAt: new Date(),
      }),
    );
  }

  private async requireActiveCart(identity: CartIdentity): Promise<Cart> {
    const cart = await this.resolveActiveCart(identity, false);
    if (!cart) throw new NotFoundException('No active cart');
    return cart;
  }

  private async requireItem(cart: Cart, itemId: string): Promise<CartItem> {
    const item = await this.itemRepository.findById(itemId);
    if (!item || item.cartId !== cart.id) {
      throw new ForbiddenException(`Item ${itemId} is not in this cart`);
    }
    return item;
  }

  private async touch(cart: Cart): Promise<void> {
    cart.lastActivityAt = new Date();
    await this.cartRepository.save(cart);
  }

  private async buildResponseById(
    cartId: string,
    guestId: string | null,
  ): Promise<CartResponseDto> {
    const cart = await this.cartRepository.findWithItems(cartId);
    if (!cart) return this.emptyResponse(guestId);
    return this.buildResponse(cart);
  }

  /**
   * Enrich a cart: refresh price snapshots (D21), annotate availability (D22),
   * compute the subtotal.
   */
  private async buildResponse(cart: Cart): Promise<CartResponseDto> {
    const items = cart.items ?? [];
    const variantIds = items.map((i) => i.variantId);
    const availability =
      await this.inventoryService.getBulkAvailability(variantIds);
    const availMap = new Map(availability.map((a) => [a.variantId, a]));

    const lines: CartItemResponseDto[] = [];
    let subtotal = 0;
    for (const item of items) {
      const info = await this.variantService.getVariantSaleInfo(item.variantId);
      let priceChanged = false;
      if (info && info.sellable && info.unitPrice !== item.unitPriceSnapshot) {
        item.unitPriceSnapshot = info.unitPrice;
        item.productNameSnapshot = info.productName;
        priceChanged = true;
        await this.itemRepository.save(item);
      }
      const available = availMap.get(item.variantId)?.available ?? 0;
      const lineTotal = item.unitPriceSnapshot * item.quantity;
      subtotal += lineTotal;
      const line = new CartItemResponseDto();
      line.id = item.id;
      line.variantId = item.variantId;
      line.productId = item.productId;
      line.productName = item.productNameSnapshot;
      line.quantity = item.quantity;
      line.unitPrice = item.unitPriceSnapshot;
      line.lineTotal = lineTotal;
      line.available = available;
      line.inStock = available > 0;
      line.sellable = info?.sellable ?? false;
      line.priceChanged = priceChanged;
      lines.push(line);
    }

    const dto = new CartResponseDto();
    dto.id = cart.id;
    dto.status = cart.status;
    dto.currency = cart.currency;
    dto.couponCode = cart.couponCode;
    dto.items = lines;
    dto.itemCount = lines.reduce((n, l) => n + l.quantity, 0);
    dto.subtotal = subtotal;
    dto.guestId = cart.guestId;
    return dto;
  }

  private emptyResponse(guestId: string | null): CartResponseDto {
    const dto = new CartResponseDto();
    dto.id = '';
    dto.status = CartStatus.ACTIVE;
    dto.currency = 'BDT';
    dto.couponCode = null;
    dto.items = [];
    dto.itemCount = 0;
    dto.subtotal = 0;
    dto.guestId = guestId;
    return dto;
  }
}
