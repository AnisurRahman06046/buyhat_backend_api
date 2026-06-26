import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CMS_WRITE_ROLES } from '../cms.constants';
import { CreateLandingPageDto } from '../dto/create-landing-page.dto';
import { UpdateLandingPageDto } from '../dto/update-landing-page.dto';
import { LandingPageService } from '../services/landing-page.service';

@ApiTags('cms')
@Controller('cms/landing-pages')
export class LandingPageController {
  constructor(private readonly landingPageService: LandingPageService) {}

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List landing pages (drafts + published)' })
  list() {
    return this.landingPageService.list();
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a landing page' })
  create(@Body() dto: CreateLandingPageDto) {
    return this.landingPageService.create(dto);
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update a landing page' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLandingPageDto,
  ) {
    return this.landingPageService.update(id, dto);
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a landing page' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.landingPageService.remove(id);
  }

  // Public: by slug, published only. Declared last; a slug never matches a UUID
  // so it won't shadow the admin :id routes (different verbs anyway).
  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a published landing page by slug (public)' })
  bySlug(@Param('slug') slug: string) {
    return this.landingPageService.getPublishedBySlug(slug);
  }
}
