import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { AttributeFilter, ProductSearchSort } from '../search/search.types';

const SORTS: ProductSearchSort[] = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
];

/** Public faceted product search (keyset-paginated). */
export class ProductSearchQueryDto {
  @ApiPropertyOptional({ description: 'Full-text query (name + description)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description:
      'Attribute filters as `attributeId:optionId` pairs (repeat or comma-separate)',
    isArray: true,
    type: String,
  })
  @IsOptional()
  @Transform(({ value }): string[] =>
    Array.isArray(value)
      ? (value as string[])
      : typeof value === 'string'
        ? value.split(',')
        : [],
  )
  @IsString({ each: true })
  attr?: string[];

  @ApiPropertyOptional({ enum: SORTS })
  @IsOptional()
  @IsIn(SORTS)
  sort?: ProductSearchSort;

  @ApiPropertyOptional({
    description: 'Opaque keyset cursor from a prior page',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  /** Group raw `attr` pairs into per-attribute option lists (invalid ignored). */
  toAttributeFilters(): AttributeFilter[] {
    const byAttr = new Map<string, Set<string>>();
    for (const raw of this.attr ?? []) {
      const [attributeId, optionId] = raw.split(':');
      if (!attributeId || !optionId) continue;
      const set = byAttr.get(attributeId) ?? new Set<string>();
      set.add(optionId);
      byAttr.set(attributeId, set);
    }
    return [...byAttr.entries()].map(([attributeId, optionIds]) => ({
      attributeId,
      optionIds: [...optionIds],
    }));
  }
}
