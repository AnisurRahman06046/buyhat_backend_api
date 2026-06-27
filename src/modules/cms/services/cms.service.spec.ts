import { BrandService, CategoryService, ProductService } from '../../catalog';
import { PromotionsService } from '../../promotions';
import { ReportingService } from '../../reporting';
import { CacheService } from '../../../shared/cache';
import { HomepageSection } from '../entities/homepage-section.entity';
import { BannerPlacement } from '../enums/banner-placement.enum';
import { HomepageSectionType } from '../enums/homepage-section-type.enum';
import { HomepageSectionRepository } from '../repositories/homepage-section.repository';
import { BannerService } from './banner.service';
import { CmsService } from './cms.service';

const makeSection = (
  type: HomepageSectionType,
  config: Record<string, unknown> = {},
  position = 0,
): HomepageSection =>
  ({
    id: `sec-${type}`,
    type,
    title: type,
    position,
    isActive: true,
    config,
    deletedAt: null,
  }) as HomepageSection;

describe('CmsService (homepage hydration)', () => {
  let sectionRepository: jest.Mocked<HomepageSectionRepository>;
  let bannerService: jest.Mocked<BannerService>;
  let productService: jest.Mocked<ProductService>;
  let categoryService: jest.Mocked<CategoryService>;
  let brandService: jest.Mocked<BrandService>;
  let promotionsService: jest.Mocked<PromotionsService>;
  let reportingService: jest.Mocked<ReportingService>;
  let cache: jest.Mocked<CacheService>;
  let service: CmsService;

  beforeEach(() => {
    sectionRepository = {
      findActiveOrdered: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<HomepageSectionRepository>;
    bannerService = {
      activeByPlacement: jest.fn().mockResolvedValue([{ id: 'b1' }]),
    } as unknown as jest.Mocked<BannerService>;
    productService = {
      getProductSummaries: jest.fn().mockResolvedValue([{ id: 'p1' }]),
    } as unknown as jest.Mocked<ProductService>;
    categoryService = {
      getCategorySummaries: jest.fn().mockResolvedValue([{ id: 'c1' }]),
    } as unknown as jest.Mocked<CategoryService>;
    brandService = {
      getBrandSummaries: jest.fn().mockResolvedValue([{ id: 'br1' }]),
    } as unknown as jest.Mocked<BrandService>;
    promotionsService = {
      listActiveFlashSales: jest.fn().mockResolvedValue([{ id: 'fs1' }]),
    } as unknown as jest.Mocked<PromotionsService>;
    reportingService = {
      getBestSellers: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ReportingService>;
    cache = {
      // Pass-through so the loader runs and hydration assertions hold.
      getOrSet: jest.fn(
        (_key: string, _ttl: number, loader: () => Promise<unknown>) =>
          loader(),
      ),
    } as unknown as jest.Mocked<CacheService>;

    service = new CmsService(
      sectionRepository,
      bannerService,
      productService,
      categoryService,
      brandService,
      promotionsService,
      reportingService,
      cache,
    );
  });

  it('renders active sections in position order', async () => {
    sectionRepository.findActiveOrdered.mockResolvedValue([
      makeSection(HomepageSectionType.NEWSLETTER, { title: 'Join' }, 0),
      makeSection(HomepageSectionType.BRANDS, {}, 1),
    ]);
    const rendered = await service.getHomepage();
    expect(rendered.map((s) => s.type)).toEqual([
      HomepageSectionType.NEWSLETTER,
      HomepageSectionType.BRANDS,
    ]);
  });

  it('hydrates HERO_SLIDER from active HOME_HERO banners', async () => {
    sectionRepository.findActiveOrdered.mockResolvedValue([
      makeSection(HomepageSectionType.HERO_SLIDER),
    ]);
    const [hero] = await service.getHomepage();
    expect(bannerService.activeByPlacement).toHaveBeenCalledWith(
      BannerPlacement.HOME_HERO,
    );
    expect(hero.banners).toHaveLength(1);
  });

  it('hydrates FEATURED_PRODUCTS from config.productIds', async () => {
    sectionRepository.findActiveOrdered.mockResolvedValue([
      makeSection(HomepageSectionType.FEATURED_PRODUCTS, {
        productIds: ['p1', 'p2'],
      }),
    ]);
    const [section] = await service.getHomepage();
    expect(productService.getProductSummaries).toHaveBeenCalledWith([
      'p1',
      'p2',
    ]);
    expect(section.products).toBeDefined();
  });

  it('hydrates CATEGORY_GRID from config.categoryIds', async () => {
    sectionRepository.findActiveOrdered.mockResolvedValue([
      makeSection(HomepageSectionType.CATEGORY_GRID, { categoryIds: ['c1'] }),
    ]);
    const [section] = await service.getHomepage();
    expect(categoryService.getCategorySummaries).toHaveBeenCalledWith(['c1']);
    expect(section.categories).toBeDefined();
  });

  it('hydrates FLASH_SALE from active flash sales', async () => {
    sectionRepository.findActiveOrdered.mockResolvedValue([
      makeSection(HomepageSectionType.FLASH_SALE),
    ]);
    const [section] = await service.getHomepage();
    expect(promotionsService.listActiveFlashSales).toHaveBeenCalled();
    expect(section.flashSales).toHaveLength(1);
  });

  it('BANNER uses the configured placement (default HOME_STRIP)', async () => {
    sectionRepository.findActiveOrdered.mockResolvedValue([
      makeSection(HomepageSectionType.BANNER, {}),
    ]);
    await service.getHomepage();
    expect(bannerService.activeByPlacement).toHaveBeenCalledWith(
      BannerPlacement.HOME_STRIP,
    );
  });

  it('passes NEWSLETTER config straight through (no hydration)', async () => {
    sectionRepository.findActiveOrdered.mockResolvedValue([
      makeSection(HomepageSectionType.NEWSLETTER, { heading: 'Subscribe' }),
    ]);
    const [section] = await service.getHomepage();
    expect(section.config).toEqual({ heading: 'Subscribe' });
    expect(productService.getProductSummaries).not.toHaveBeenCalled();
  });

  it('defensively reads missing id lists as empty (D52)', async () => {
    sectionRepository.findActiveOrdered.mockResolvedValue([
      makeSection(HomepageSectionType.FEATURED_PRODUCTS, {}),
    ]);
    await service.getHomepage();
    expect(productService.getProductSummaries).toHaveBeenCalledWith([]);
  });
});
