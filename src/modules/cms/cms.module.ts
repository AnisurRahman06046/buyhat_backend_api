import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog';
import { PromotionsModule } from '../promotions';
import { ReportingModule } from '../reporting';
import { BannerController } from './controllers/banner.controller';
import { CmsMediaController } from './controllers/cms-media.controller';
import { CmsPublicController } from './controllers/cms-public.controller';
import { HomepageAdminController } from './controllers/homepage-admin.controller';
import { LandingPageController } from './controllers/landing-page.controller';
import { PopupController } from './controllers/popup.controller';
import { CmsBanner } from './entities/cms-banner.entity';
import { CmsPopup } from './entities/cms-popup.entity';
import { HomepageSection } from './entities/homepage-section.entity';
import { LandingPage } from './entities/landing-page.entity';
import { CmsBannerRepository } from './repositories/cms-banner.repository';
import { CmsPopupRepository } from './repositories/cms-popup.repository';
import { HomepageSectionRepository } from './repositories/homepage-section.repository';
import { LandingPageRepository } from './repositories/landing-page.repository';
import { BannerService } from './services/banner.service';
import { CmsMediaService } from './services/cms-media.service';
import { CmsService } from './services/cms.service';
import { HomepageSectionService } from './services/homepage-section.service';
import { LandingPageService } from './services/landing-page.service';
import { PopupService } from './services/popup.service';

/**
 * `cms` feature module — admin-composable homepage (ordered sections), scheduled
 * banners / hero slider, rule-driven popups, and landing pages. The public
 * `CmsService` hydrates the homepage by reading catalog + promotions one-way
 * (never their tables); images are uploaded via the global StorageModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      HomepageSection,
      CmsBanner,
      CmsPopup,
      LandingPage,
    ]),
    CatalogModule,
    PromotionsModule,
    ReportingModule,
  ],
  controllers: [
    HomepageAdminController,
    BannerController,
    PopupController,
    LandingPageController,
    CmsMediaController,
    CmsPublicController,
  ],
  providers: [
    HomepageSectionRepository,
    CmsBannerRepository,
    CmsPopupRepository,
    LandingPageRepository,
    HomepageSectionService,
    BannerService,
    PopupService,
    LandingPageService,
    CmsMediaService,
    CmsService,
  ],
})
export class CmsModule {}
