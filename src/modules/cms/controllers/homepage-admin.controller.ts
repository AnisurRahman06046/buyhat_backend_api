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
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CMS_WRITE_ROLES } from '../cms.constants';
import { CreateHomepageSectionDto } from '../dto/create-homepage-section.dto';
import { ReorderSectionsDto } from '../dto/reorder-sections.dto';
import { UpdateHomepageSectionDto } from '../dto/update-homepage-section.dto';
import { HomepageSectionService } from '../services/homepage-section.service';

@ApiTags('cms')
@ApiBearerAuth()
@Roles(...CMS_WRITE_ROLES)
@Controller('cms/homepage')
export class HomepageAdminController {
  constructor(private readonly sectionService: HomepageSectionService) {}

  @Get('sections')
  @ApiOperation({ summary: 'List all homepage sections' })
  list() {
    return this.sectionService.list();
  }

  @Post('sections')
  @ApiOperation({ summary: 'Add a homepage section' })
  create(@Body() dto: CreateHomepageSectionDto) {
    return this.sectionService.create(dto);
  }

  @Patch('sections/:id')
  @ApiOperation({ summary: 'Update a homepage section' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHomepageSectionDto,
  ) {
    return this.sectionService.update(id, dto);
  }

  @Delete('sections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a homepage section' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sectionService.remove(id);
  }

  @Put('order')
  @ApiOperation({ summary: 'Reorder homepage sections' })
  reorder(@Body() dto: ReorderSectionsDto) {
    return this.sectionService.reorder(dto.sectionIds);
  }
}
