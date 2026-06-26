import { Injectable } from '@nestjs/common';
import { BrandService, CategoryService, ProductService } from '../../catalog';
import { PromotionsService } from '../../promotions';
import { RenderedHomepageSectionDto } from '../dto/homepage-section-response.dto';
import { HomepageSection } from '../entities/homepage-section.entity';
import { BannerPlacement } from '../enums/banner-placement.enum';
import { HomepageSectionType } from '../enums/homepage-section-type.enum';
import { HomepageSectionRepository } from '../repositories/homepage-section.repository';
import { BannerService } from './banner.service';

/** Reads `config.<key>` as a list of string ids (defensive — D52). */
function idList(config: Record<string, unknown>, key: string): string[] {
  const value = config?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

/**
 * Public read facade: assembles the **hydrated** homepage (D46). Active sections
 * in order, each enriched with the data its type needs — banners (same module),
 * flash sales (promotions), product/category/brand summaries (catalog). All
 * cross-module reads are one-way; missing ids are skipped, never fatal.
 */
@Injectable()
export class CmsService {
  constructor(
    private readonly sectionRepository: HomepageSectionRepository,
    private readonly bannerService: BannerService,
    private readonly productService: ProductService,
    private readonly categoryService: CategoryService,
    private readonly brandService: BrandService,
    private readonly promotionsService: PromotionsService,
  ) {}

  async getHomepage(): Promise<RenderedHomepageSectionDto[]> {
    const sections = await this.sectionRepository.findActiveOrdered();
    return Promise.all(sections.map((s) => this.renderSection(s)));
  }

  private async renderSection(
    section: HomepageSection,
  ): Promise<RenderedHomepageSectionDto> {
    const dto = new RenderedHomepageSectionDto();
    dto.id = section.id;
    dto.type = section.type;
    dto.title = section.title;
    dto.position = section.position;
    const config = section.config ?? {};

    switch (section.type) {
      case HomepageSectionType.HERO_SLIDER:
        dto.banners = await this.bannerService.activeByPlacement(
          BannerPlacement.HOME_HERO,
        );
        break;
      case HomepageSectionType.BANNER:
        dto.banners = await this.bannerService.activeByPlacement(
          this.placementFrom(config),
        );
        break;
      case HomepageSectionType.FLASH_SALE:
        dto.flashSales = await this.promotionsService.listActiveFlashSales();
        break;
      case HomepageSectionType.CATEGORY_GRID:
        dto.categories = await this.categoryService.getCategorySummaries(
          idList(config, 'categoryIds'),
        );
        break;
      case HomepageSectionType.FEATURED_PRODUCTS:
      case HomepageSectionType.BEST_SELLERS:
        // Manually curated product ids; automatic best-sellers = Phase 11.
        dto.products = await this.productService.getProductSummaries(
          idList(config, 'productIds'),
        );
        break;
      case HomepageSectionType.BRANDS:
        dto.brands = await this.brandService.getBrandSummaries(
          idList(config, 'brandIds'),
        );
        break;
      case HomepageSectionType.NEWSLETTER:
      default:
        dto.config = config;
        break;
    }
    return dto;
  }

  private placementFrom(config: Record<string, unknown>): BannerPlacement {
    const raw = config?.placement;
    return typeof raw === 'string' &&
      (Object.values(BannerPlacement) as string[]).includes(raw)
      ? (raw as BannerPlacement)
      : BannerPlacement.HOME_STRIP;
  }
}
