import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CATALOG_WRITE_ROLES,
  MEDIA_UPLOAD_HARD_LIMIT_BYTES,
} from '../catalog.constants';
import { PresignMediaDto, RecordMediaDto } from '../dto/presign-media.dto';
import { UpdateMediaDto } from '../dto/update-media.dto';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { MediaService } from '../services/media.service';

@ApiTags('catalog/media')
@ApiBearerAuth()
@Roles(...CATALOG_WRITE_ROLES)
@Controller()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('products/:id/media')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a product/variant image (multipart)' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MEDIA_UPLOAD_HARD_LIMIT_BYTES },
    }),
  )
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
  ) {
    return this.mediaService.upload(id, file, dto);
  }

  @Get('products/:id/media')
  @ApiOperation({ summary: 'List a product media' })
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.listForProduct(id);
  }

  @Post('products/:id/media/presign')
  @ApiOperation({ summary: 'Get a presigned upload URL (S3 driver only)' })
  presign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignMediaDto,
  ) {
    return this.mediaService.presign(id, dto);
  }

  @Post('products/:id/media/record')
  @ApiOperation({ summary: 'Record media after a presigned upload' })
  record(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordMediaDto) {
    return this.mediaService.record(id, dto);
  }

  @Put('media/:id')
  @ApiOperation({ summary: 'Update media (alt, primary, position)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMediaDto) {
    return this.mediaService.update(id, dto);
  }

  @Delete('media/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete media' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.mediaService.remove(id);
    return { deleted: true };
  }
}
