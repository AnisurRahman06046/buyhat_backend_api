import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';
import { NotificationChannel } from '../enums/notification-channel.enum';
import {
  NOTIFICATIONS_ADMIN_ROLES,
  NOTIFICATIONS_VIEW_ROLES,
} from '../notifications.constants';
import { NotificationService } from '../services/notification.service';
import { PreferenceService } from '../services/preference.service';
import { TemplateService } from '../services/template.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly templateService: TemplateService,
    private readonly preferenceService: PreferenceService,
  ) {}

  // --- preferences (authenticated user) --------------------------------------

  @Get('preferences')
  @ApiOperation({ summary: 'Read your marketing opt-out preferences' })
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.preferenceService.get(user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update your marketing opt-out preferences' })
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.preferenceService.update(user.id, dto);
  }

  // --- templates (staff) -----------------------------------------------------

  @Roles(...NOTIFICATIONS_ADMIN_ROLES)
  @Get('templates')
  @ApiOperation({ summary: 'List templates (defaults + overrides)' })
  listTemplates() {
    return this.templateService.list();
  }

  @Roles(...NOTIFICATIONS_ADMIN_ROLES)
  @Patch('templates/:id')
  @ApiOperation({ summary: 'Edit/override a template (id = `event::channel`)' })
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templateService.update(id, dto);
  }

  // --- ad-hoc send (staff) ---------------------------------------------------

  @Roles(...NOTIFICATIONS_ADMIN_ROLES)
  @Post('email')
  @ApiOperation({ summary: 'Send an ad-hoc email through the pipeline' })
  sendEmail(@Body() dto: SendNotificationDto) {
    return this.notificationService.sendManual(NotificationChannel.EMAIL, dto);
  }

  @Roles(...NOTIFICATIONS_ADMIN_ROLES)
  @Post('sms')
  @ApiOperation({ summary: 'Send an ad-hoc SMS through the pipeline' })
  sendSms(@Body() dto: SendNotificationDto) {
    return this.notificationService.sendManual(NotificationChannel.SMS, dto);
  }

  @Roles(...NOTIFICATIONS_ADMIN_ROLES)
  @Post('push')
  @ApiOperation({ summary: 'Send an ad-hoc push through the pipeline' })
  sendPush(@Body() dto: SendNotificationDto) {
    return this.notificationService.sendManual(NotificationChannel.PUSH, dto);
  }

  // --- delivery log (staff incl. customer support) ---------------------------

  @Roles(...NOTIFICATIONS_VIEW_ROLES)
  @Get()
  @ApiOperation({ summary: 'Delivery log (filter status/channel)' })
  list(@Query() query: NotificationQueryDto) {
    return this.notificationService.list(query);
  }
}
