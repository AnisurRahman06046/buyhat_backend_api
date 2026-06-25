import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, DataSource } from 'typeorm';
import { slugify } from '../../../common/utils/slug.util';
import { ProductStatus } from '../enums/product-status.enum';
import {
  GenerateVariantsDto,
  VariantOverrideDto,
} from '../dto/generate-variants.dto';
import { UpdateVariantDto } from '../dto/update-variant.dto';
import { VariantResponseDto } from '../dto/variant-response.dto';
import { Attribute } from '../entities/attribute.entity';
import { AttributeOption } from '../entities/attribute-option.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { ProductRepository } from '../repositories/product.repository';
import { ProductVariantRepository } from '../repositories/product-variant.repository';
import { AttributeResolverService } from './attribute-resolver.service';
import { OutboxService } from './outbox.service';

const DEFAULT_MAX_VARIANTS_PER_GENERATION = 200;

/** One (attribute, chosen option) pair; a full combination is an array of these. */
type Pair = { attribute: Attribute; option: AttributeOption };
type Combination = Pair[];

export interface GenerateVariantsResult {
  created: number;
  skipped: number;
  variants: VariantResponseDto[];
}

/** Minimal variant info other modules (cart, orders) need to price a line. */
export interface VariantSaleInfo {
  variantId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  currency: string;
  /** true when the variant is active and its product is published & not deleted. */
  sellable: boolean;
}

@Injectable()
export class VariantService {
  private readonly maxVariantsPerGeneration: number;

  constructor(
    private readonly productRepository: ProductRepository,
    private readonly variantRepository: ProductVariantRepository,
    private readonly attributeResolver: AttributeResolverService,
    private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
    config: ConfigService,
  ) {
    this.maxVariantsPerGeneration =
      config.get<number>('catalog.maxVariantsPerGeneration') ??
      DEFAULT_MAX_VARIANTS_PER_GENERATION;
  }

  /** Generate variants from the cartesian product of selected options (idempotent). */
  async generate(
    productId: string,
    dto: GenerateVariantsDto,
    actorId: string,
  ): Promise<GenerateVariantsResult> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const resolved = await this.attributeResolver.resolveForCategory(
      product.categoryId,
    );
    const variantDefining = new Map(
      resolved
        .filter((r) => r.attribute.isVariantDefining)
        .map((r) => [r.attribute.code, r.attribute]),
    );

    const entries = Object.entries(dto.options ?? {});
    if (entries.length === 0) {
      throw new BadRequestException(
        'Provide at least one variant-defining attribute in "options"',
      );
    }

    const axes: { attribute: Attribute; options: AttributeOption[] }[] = [];
    for (const [code, optionIds] of entries) {
      const attribute = variantDefining.get(code);
      if (!attribute) {
        throw new BadRequestException(
          `"${code}" is not a variant-defining attribute of this product's category`,
        );
      }
      const ids = Array.isArray(optionIds) ? optionIds : [];
      if (ids.length === 0) {
        throw new BadRequestException(
          `Provide at least one option id for "${code}"`,
        );
      }
      const options = (attribute.options ?? []).filter((o) =>
        ids.includes(o.id),
      );
      if (options.length !== new Set(ids).size) {
        throw new BadRequestException(
          `Some option ids are invalid for "${code}"`,
        );
      }
      axes.push({ attribute, options });
    }

    const combinations = this.cartesian(axes);
    if (combinations.length > this.maxVariantsPerGeneration) {
      throw new BadRequestException(
        `Generation would create ${combinations.length} variants (max ${this.maxVariantsPerGeneration})`,
      );
    }

    const existing = await this.variantRepository.existingSignatures(productId);
    const usedSkus = new Set<string>();
    const createdVariants: ProductVariant[] = [];
    let created = 0;
    let skipped = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const combo of combinations) {
        const signature = this.signatureOf(combo);
        if (existing.has(signature)) {
          skipped += 1;
          continue;
        }
        const override = this.matchOverride(dto.overrides, combo);
        const price =
          override?.price ?? dto.defaults?.price ?? product.basePrice;
        if (price == null) {
          throw new BadRequestException(
            'A price is required (variant override, defaults.price, or product base_price)',
          );
        }
        const sku =
          override?.sku ??
          (await this.uniqueSku(
            `${product.slug}-${combo.map((c) => c.option.value).join('-')}`,
            manager,
            usedSkus,
          ));
        usedSkus.add(sku);

        const saved = await manager.save(
          manager.create(ProductVariant, {
            productId,
            sku,
            price,
            weight: dto.defaults?.weight ?? null,
            attributeSignature: signature,
            createdBy: actorId,
            attributeValues: combo.map((c) => ({
              attributeId: c.attribute.id,
              optionId: c.option.id,
            })),
          }),
        );
        const full = await manager.findOne(ProductVariant, {
          where: { id: saved.id },
          relations: { attributeValues: true },
        });
        // Announce to inventory (Phase 3) so a stock_item (qty 0) is provisioned.
        await this.outboxService.record(manager, {
          aggregateType: 'product_variant',
          aggregateId: saved.id,
          eventType: 'variant.created',
          payload: { variantId: saved.id, productId, sku: saved.sku },
        });
        createdVariants.push(full ?? saved);
        existing.add(signature);
        created += 1;
      }
    });

    return {
      created,
      skipped,
      variants: createdVariants.map((v) => VariantResponseDto.fromEntity(v)),
    };
  }

  /** Cross-module (cart/orders): price + sellability for a single variant. */
  async getVariantSaleInfo(variantId: string): Promise<VariantSaleInfo | null> {
    const variant = await this.variantRepository.findWithProduct(variantId);
    if (!variant) return null;
    const product = variant.product;
    const sellable =
      variant.isActive &&
      !!product &&
      product.status === ProductStatus.ACTIVE &&
      !product.deletedAt;
    return {
      variantId: variant.id,
      productId: variant.productId,
      productName: product?.name ?? '',
      unitPrice: variant.price,
      currency: product?.currency ?? 'BDT',
      sellable,
    };
  }

  async listForProduct(productId: string): Promise<VariantResponseDto[]> {
    if (!(await this.productRepository.exists({ id: productId }))) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    const variants = await this.variantRepository.findByProduct(productId);
    return variants.map((v) => VariantResponseDto.fromEntity(v));
  }

  async update(id: string, dto: UpdateVariantDto): Promise<VariantResponseDto> {
    const variant = await this.variantRepository.findDetail(id);
    if (!variant) {
      throw new NotFoundException(`Variant ${id} not found`);
    }
    if (dto.sku && dto.sku !== variant.sku) {
      if (await this.variantRepository.skuExists(dto.sku)) {
        throw new ConflictException(`SKU "${dto.sku}" already exists`);
      }
      variant.sku = dto.sku;
    }
    if (dto.price !== undefined) variant.price = dto.price;
    if (dto.barcode !== undefined) variant.barcode = dto.barcode ?? null;
    if (dto.compareAtPrice !== undefined)
      variant.compareAtPrice = dto.compareAtPrice ?? null;
    if (dto.weight !== undefined) variant.weight = dto.weight ?? null;
    if (dto.isActive !== undefined) variant.isActive = dto.isActive;
    await this.variantRepository.save(variant);
    return VariantResponseDto.fromEntity(
      (await this.variantRepository.findDetail(id))!,
    );
  }

  async remove(id: string): Promise<void> {
    if (!(await this.variantRepository.findById(id))) {
      throw new NotFoundException(`Variant ${id} not found`);
    }
    await this.variantRepository.softDelete(id);
  }

  private cartesian(
    axes: { attribute: Attribute; options: AttributeOption[] }[],
  ): Combination[] {
    return axes.reduce<Combination[]>(
      (acc, axis) =>
        acc.flatMap((combo) =>
          axis.options.map((option) => [
            ...combo,
            { attribute: axis.attribute, option },
          ]),
        ),
      [[]],
    );
  }

  /** Canonical, order-independent signature of a combination. */
  private signatureOf(combo: Combination): string {
    return combo
      .map((pair) => `${pair.attribute.id}:${pair.option.id}`)
      .sort()
      .join('|');
  }

  private matchOverride(
    overrides: VariantOverrideDto[] | undefined,
    combo: Combination,
  ): VariantOverrideDto | undefined {
    return overrides?.find((override) =>
      Object.entries(override.match).every(([code, optionId]) =>
        combo.some(
          (pair) => pair.attribute.code === code && pair.option.id === optionId,
        ),
      ),
    );
  }

  private async uniqueSku(
    base: string,
    manager: EntityManager,
    used: Set<string>,
  ): Promise<string> {
    const root = (slugify(base) || 'sku').toUpperCase();
    let candidate = root;
    let suffix = 2;
    while (
      used.has(candidate) ||
      (await manager.count(ProductVariant, {
        where: { sku: candidate },
        withDeleted: true,
      })) > 0
    ) {
      candidate = `${root}-${suffix++}`;
    }
    return candidate;
  }
}
