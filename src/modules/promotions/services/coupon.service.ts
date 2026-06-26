import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CreateCouponDto } from '../dto/create-coupon.dto';
import { UpdateCouponDto } from '../dto/update-coupon.dto';
import { CouponResponseDto } from '../dto/promotion-response.dto';
import { Coupon } from '../entities/coupon.entity';
import { CouponCategory } from '../entities/coupon-category.entity';
import { CouponRepository } from '../repositories/coupon.repository';

@Injectable()
export class CouponService {
  constructor(
    private readonly couponRepository: CouponRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateCouponDto): Promise<CouponResponseDto> {
    const code = dto.code.trim().toUpperCase();
    if (await this.couponRepository.codeExists(code)) {
      throw new ConflictException(`Coupon code "${code}" already exists`);
    }
    const id = await this.dataSource.transaction(async (manager) => {
      const coupon = await manager.save(
        manager.create(Coupon, {
          code,
          type: dto.type,
          value: dto.value,
          minPurchaseAmount: dto.minPurchaseAmount ?? null,
          maxDiscountAmount: dto.maxDiscountAmount ?? null,
          usageLimit: dto.usageLimit ?? null,
          usageLimitPerUser: dto.usageLimitPerUser ?? null,
          usageLimitPerIp: dto.usageLimitPerIp ?? null,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          isActive: dto.isActive ?? true,
          promotionId: dto.promotionId ?? null,
        }),
      );
      await this.replaceCategories(manager, coupon.id, dto.categoryIds);
      return coupon.id;
    });
    return this.get(id);
  }

  async update(id: string, dto: UpdateCouponDto): Promise<CouponResponseDto> {
    const coupon = await this.couponRepository.findById(id);
    if (!coupon) throw new NotFoundException(`Coupon ${id} not found`);

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      if (
        code !== coupon.code &&
        (await this.couponRepository.codeExists(code))
      ) {
        throw new ConflictException(`Coupon code "${code}" already exists`);
      }
      coupon.code = code;
    }
    if (dto.type !== undefined) coupon.type = dto.type;
    if (dto.value !== undefined) coupon.value = dto.value;
    if (dto.minPurchaseAmount !== undefined)
      coupon.minPurchaseAmount = dto.minPurchaseAmount;
    if (dto.maxDiscountAmount !== undefined)
      coupon.maxDiscountAmount = dto.maxDiscountAmount;
    if (dto.usageLimit !== undefined) coupon.usageLimit = dto.usageLimit;
    if (dto.usageLimitPerUser !== undefined)
      coupon.usageLimitPerUser = dto.usageLimitPerUser;
    if (dto.usageLimitPerIp !== undefined)
      coupon.usageLimitPerIp = dto.usageLimitPerIp;
    if (dto.startsAt !== undefined)
      coupon.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined)
      coupon.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.isActive !== undefined) coupon.isActive = dto.isActive;
    if (dto.promotionId !== undefined) coupon.promotionId = dto.promotionId;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(coupon);
      if (dto.categoryIds !== undefined) {
        await this.replaceCategories(manager, coupon.id, dto.categoryIds);
      }
    });
    return this.get(id);
  }

  async list(): Promise<CouponResponseDto[]> {
    const coupons = await this.couponRepository.findMany({
      relations: { categories: true },
      order: { createdAt: 'DESC' },
    });
    return coupons.map((c) => CouponResponseDto.fromEntity(c));
  }

  async get(id: string): Promise<CouponResponseDto> {
    const coupon = await this.couponRepository.findWithCategories(id);
    if (!coupon) throw new NotFoundException(`Coupon ${id} not found`);
    return CouponResponseDto.fromEntity(coupon);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.couponRepository.exists({ id }))) {
      throw new NotFoundException(`Coupon ${id} not found`);
    }
    await this.couponRepository.softDelete(id);
  }

  private async replaceCategories(
    manager: EntityManager,
    couponId: string,
    categoryIds: string[] | undefined,
  ): Promise<void> {
    if (categoryIds === undefined) return;
    await manager.delete(CouponCategory, { couponId });
    const unique = [...new Set(categoryIds)];
    for (const categoryId of unique) {
      await manager.save(
        manager.create(CouponCategory, { couponId, categoryId }),
      );
    }
  }
}
