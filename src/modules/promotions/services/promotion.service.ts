import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
} from '../dto/create-promotion.dto';
import { PromotionResponseDto } from '../dto/promotion-response.dto';
import { PromotionRepository } from '../repositories/promotion.repository';

/** Campaign container CRUD (coupons may link to a promotion). */
@Injectable()
export class PromotionService {
  constructor(private readonly promotionRepository: PromotionRepository) {}

  async create(dto: CreatePromotionDto): Promise<PromotionResponseDto> {
    const promotion = await this.promotionRepository.save(
      this.promotionRepository.create({
        name: dto.name,
        description: dto.description ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: dto.isActive ?? true,
      }),
    );
    return PromotionResponseDto.fromEntity(promotion);
  }

  async update(
    id: string,
    dto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    const promotion = await this.promotionRepository.findById(id);
    if (!promotion) throw new NotFoundException(`Promotion ${id} not found`);
    if (dto.name !== undefined) promotion.name = dto.name;
    if (dto.description !== undefined)
      promotion.description = dto.description ?? null;
    if (dto.startsAt !== undefined)
      promotion.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined)
      promotion.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.isActive !== undefined) promotion.isActive = dto.isActive;
    const saved = await this.promotionRepository.save(promotion);
    return PromotionResponseDto.fromEntity(saved);
  }

  async list(): Promise<PromotionResponseDto[]> {
    const promotions = await this.promotionRepository.findMany({
      order: { createdAt: 'DESC' },
    });
    return promotions.map((p) => PromotionResponseDto.fromEntity(p));
  }

  async get(id: string): Promise<PromotionResponseDto> {
    const promotion = await this.promotionRepository.findById(id);
    if (!promotion) throw new NotFoundException(`Promotion ${id} not found`);
    return PromotionResponseDto.fromEntity(promotion);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.promotionRepository.exists({ id }))) {
      throw new NotFoundException(`Promotion ${id} not found`);
    }
    await this.promotionRepository.softDelete(id);
  }
}
