import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { CmsService } from '../services/cms.service';

@ApiTags('cms')
@Public()
@Controller('cms')
export class CmsPublicController {
  constructor(private readonly cmsService: CmsService) {}

  @Get('homepage')
  @ApiOperation({ summary: 'Rendered homepage layout (public, hydrated)' })
  homepage() {
    return this.cmsService.getHomepage();
  }
}
