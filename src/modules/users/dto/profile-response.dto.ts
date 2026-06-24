import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../common/enums/role.enum';
import { AccountIdentity, AccountStatus } from '../../auth';
import { Profile } from '../entities/profile.entity';

/**
 * The composed user view: identity (from `auth.account`) + profile (from
 * `users.profile`). `id` is the global user id (= account id).
 */
export class ProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: Role, isArray: true }) roles: Role[];
  @ApiProperty({ enum: AccountStatus }) status: AccountStatus;
  @ApiProperty() emailVerified: boolean;
  @ApiProperty({ nullable: true }) firstName: string | null;
  @ApiProperty({ nullable: true }) lastName: string | null;
  @ApiProperty({ nullable: true }) displayName: string | null;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty({ nullable: true }) avatarUrl: string | null;
  @ApiProperty() locale: string;
  @ApiProperty() currency: string;
  @ApiProperty() marketingOptIn: boolean;
  @ApiProperty({ type: 'object', additionalProperties: true })
  preferences: Record<string, unknown>;
  @ApiProperty() createdAt: Date;

  static fromParts(
    identity: AccountIdentity,
    profile: Profile | null,
  ): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.id = identity.id;
    dto.email = identity.email;
    dto.roles = identity.roles;
    dto.status = identity.status;
    dto.emailVerified = identity.emailVerifiedAt !== null;
    dto.firstName = profile?.firstName ?? null;
    dto.lastName = profile?.lastName ?? null;
    dto.displayName = profile?.displayName ?? null;
    dto.phone = profile?.phone ?? null;
    dto.avatarUrl = profile?.avatarUrl ?? null;
    dto.locale = profile?.locale ?? 'en';
    dto.currency = profile?.currency ?? 'BDT';
    dto.marketingOptIn = profile?.marketingOptIn ?? false;
    dto.preferences = profile?.preferences ?? {};
    dto.createdAt = identity.createdAt;
    return dto;
  }
}
