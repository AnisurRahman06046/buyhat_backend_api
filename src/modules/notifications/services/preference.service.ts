import { Injectable } from '@nestjs/common';
import { PreferencesResponseDto } from '../dto/preferences-response.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationPreferenceRepository } from '../repositories/notification-preference.repository';

/**
 * Per-user marketing opt-out (D60). Missing row ⇒ opted in (all true).
 * TRANSACTIONAL messages never consult this service.
 */
@Injectable()
export class PreferenceService {
  constructor(private readonly repo: NotificationPreferenceRepository) {}

  async get(userId: string): Promise<PreferencesResponseDto> {
    const pref = await this.repo.findByUserId(userId);
    return {
      marketingEmail: pref?.marketingEmail ?? true,
      marketingSms: pref?.marketingSms ?? true,
      marketingPush: pref?.marketingPush ?? true,
    };
  }

  async update(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<PreferencesResponseDto> {
    let pref = await this.repo.findByUserId(userId);
    if (!pref) {
      pref = this.repo.create({ userId });
    }
    if (dto.marketingEmail !== undefined)
      pref.marketingEmail = dto.marketingEmail;
    if (dto.marketingSms !== undefined) pref.marketingSms = dto.marketingSms;
    if (dto.marketingPush !== undefined) pref.marketingPush = dto.marketingPush;
    try {
      pref = await this.repo.save(pref);
    } catch (error) {
      // Lost a race creating the row — re-read and re-apply.
      if (this.isUniqueViolation(error)) {
        const existing = await this.repo.findByUserId(userId);
        if (existing) {
          if (dto.marketingEmail !== undefined)
            existing.marketingEmail = dto.marketingEmail;
          if (dto.marketingSms !== undefined)
            existing.marketingSms = dto.marketingSms;
          if (dto.marketingPush !== undefined)
            existing.marketingPush = dto.marketingPush;
          pref = await this.repo.save(existing);
        }
      } else {
        throw error;
      }
    }
    return {
      marketingEmail: pref.marketingEmail,
      marketingSms: pref.marketingSms,
      marketingPush: pref.marketingPush,
    };
  }

  /** Whether MARKETING may go out to this user on the given channel. */
  async isMarketingAllowed(
    userId: string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const prefs = await this.get(userId);
    switch (channel) {
      case NotificationChannel.EMAIL:
        return prefs.marketingEmail;
      case NotificationChannel.SMS:
        return prefs.marketingSms;
      case NotificationChannel.PUSH:
        return prefs.marketingPush;
      default:
        return true;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      (error as { driverError?: { code?: string } })?.driverError?.code ===
      '23505'
    );
  }
}
