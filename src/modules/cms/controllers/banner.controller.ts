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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CMS_WRITE_ROLES } from '../cms.constants';
import { CreateBannerDto } from '../dto/create-banner.dto';
import { UpdateBannerDto } from '../dto/update-banner.dto';
import { BannerPlacement } from '../enums/banner-placement.enum';
import { BannerService } from '../services/banner.service';

@ApiTags('cms')
@Controller('cms/banners')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  // Declared before ':id' so "active" isn't captured as an id.
  @Public()
  @Get('active')
  @ApiOperation({ summary: 'Active banners for a placement (public)' })
  active(@Query('placement') placement?: BannerPlacement) {
    return this.bannerService.activeByPlacement(
      placement ?? BannerPlacement.HOME_HERO,
    );
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List banners' })
  list() {
    return this.bannerService.list();
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a banner / hero slide' })
  create(@Body() dto: CreateBannerDto) {
    return this.bannerService.create(dto);
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Get a banner' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannerService.get(id);
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update a banner' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBannerDto) {
    return this.bannerService.update(id, dto);
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a banner' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannerService.remove(id);
  }
}
