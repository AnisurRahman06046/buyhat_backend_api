import { Injectable, NotFoundException } from '@nestjs/common';
import { uniqueSlug } from '../../../common/utils/slug.util';
import { BrandResponseDto } from '../dto/brand-response.dto';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { Brand } from '../entities/brand.entity';
import { BrandRepository } from '../repositories/brand.repository';

@Injectable()
export class BrandService {
  constructor(private readonly brandRepository: BrandRepository) {}

  async create(dto: CreateBrandDto): Promise<BrandResponseDto> {
    const slug = await uniqueSlug(dto.slug ?? dto.name, (s) =>
      this.brandRepository.slugExists(s),
    );
    const brand = await this.brandRepository.save(
      this.brandRepository.create({
        name: dto.name,
        slug,
        logoUrl: dto.logoUrl ?? null,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
      }),
    );
    return BrandResponseDto.fromEntity(brand);
  }

  async list(): Promise<BrandResponseDto[]> {
    const brands = await this.brandRepository.findAllOrdered();
    return brands.map((b) => BrandResponseDto.fromEntity(b));
  }

  async findOne(id: string): Promise<BrandResponseDto> {
    return BrandResponseDto.fromEntity(await this.getEntityOrThrow(id));
  }

  /** Cross-module (cms): all active brands (BRANDS homepage section, no ids). */
  async getActiveBrands(): Promise<BrandResponseDto[]> {
    const brands = await this.brandRepository.findActiveOrdered();
    return brands.map((b) => BrandResponseDto.fromEntity(b));
  }

  /**
   * Cross-module (cms): active brand summaries for a list of ids, in the **given
   * order**; falls back to all active brands when no ids are supplied.
   */
  async getBrandSummaries(ids: string[]): Promise<BrandResponseDto[]> {
    if (ids.length === 0) return this.getActiveBrands();
    const brands = await this.brandRepository.findByIds(ids);
    const byId = new Map(brands.map((b) => [b.id, b]));
    return ids
      .map((id) => byId.get(id))
      .filter((b): b is Brand => b != null && b.isActive)
      .map((b) => BrandResponseDto.fromEntity(b));
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandResponseDto> {
    const brand = await this.getEntityOrThrow(id);
    const { slug, ...rest } = dto;
    Object.assign(brand, rest);
    if (slug && slug !== brand.slug) {
      brand.slug = await uniqueSlug(slug, (s) =>
        this.brandRepository.slugExists(s),
      );
    }
    return BrandResponseDto.fromEntity(await this.brandRepository.save(brand));
  }

  async remove(id: string): Promise<void> {
    await this.getEntityOrThrow(id);
    await this.brandRepository.softDelete(id);
  }

  private async getEntityOrThrow(id: string): Promise<Brand> {
    const brand = await this.brandRepository.findById(id);
    if (!brand) {
      throw new NotFoundException(`Brand ${id} not found`);
    }
    return brand;
  }
}
