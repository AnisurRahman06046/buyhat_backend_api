import {
  Controller,
  Post,
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
  CMS_MEDIA_UPLOAD_LIMIT_BYTES,
  CMS_WRITE_ROLES,
} from '../cms.constants';
import { CmsMediaService } from '../services/cms-media.service';

@ApiTags('cms')
@ApiBearerAuth()
@Roles(...CMS_WRITE_ROLES)
@Controller('cms/media')
export class CmsMediaController {
  constructor(private readonly cmsMediaService: CmsMediaService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a CMS image → returns its URL' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CMS_MEDIA_UPLOAD_LIMIT_BYTES },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.cmsMediaService.upload(file);
  }
}
