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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OptionalJwtAuthGuard } from '../../../common/guards/optional-jwt-auth.guard';
import { CMS_WRITE_ROLES } from '../cms.constants';
import { CreatePopupDto } from '../dto/create-popup.dto';
import { UpdatePopupDto } from '../dto/update-popup.dto';
import { PopupService } from '../services/popup.service';

@ApiTags('cms')
@Controller('cms/popups')
export class PopupController {
  constructor(private readonly popupService: PopupService) {}

  // Optional auth so the audience filter (D50) knows guest vs logged-in.
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('active')
  @ApiOperation({ summary: 'Active popups for the caller (public)' })
  active(@CurrentUser('id') userId: string | undefined) {
    return this.popupService.activeForAudience(!!userId);
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List popups' })
  list() {
    return this.popupService.list();
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a popup' })
  create(@Body() dto: CreatePopupDto) {
    return this.popupService.create(dto);
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Get a popup' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.popupService.get(id);
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update a popup' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePopupDto) {
    return this.popupService.update(id, dto);
  }

  @Roles(...CMS_WRITE_ROLES)
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a popup' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.popupService.remove(id);
  }
}
