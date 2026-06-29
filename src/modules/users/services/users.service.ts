import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, FindOptionsWhere, Not } from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { PaginationMeta } from '../../../common/interfaces/api-response.interface';
import { buildPaginationMeta } from '../../../common/utils/pagination.util';
import { AccountIdentity, AccountService, AccountStatus } from '../../auth';
import { AuditAction, AuditService } from '../../audit';
import { AddressResponseDto } from '../dto/address-response.dto';
import { CreateAddressDto } from '../dto/create-address.dto';
import { ProfileResponseDto } from '../dto/profile-response.dto';
import { SetDefaultAddressDto } from '../dto/set-default-address.dto';
import { UpdateAddressDto } from '../dto/update-address.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserListQueryDto } from '../dto/user-list-query.dto';
import { Address } from '../entities/address.entity';
import { Profile } from '../entities/profile.entity';
import { AddressRepository } from '../repositories/address.repository';
import { ProfileRepository } from '../repositories/profile.repository';

const TERMINAL_STATUSES = [AccountStatus.SUSPENDED, AccountStatus.DEACTIVATED];

/** Contact points resolved for a user, for the notifications dispatch seam (D64). */
export interface ContactInfo {
  email: string | null;
  phone: string | null;
}

/** Address fields the orders module snapshots onto an order at checkout. */
export interface AddressSnapshot {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
}

/**
 * Profile + address use-cases, and admin account management. Identity data
 * (email, status, roles) is read/written via `AccountService` (the `auth`
 * module's public service) — never by touching auth's tables.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly addressRepository: AddressRepository,
    private readonly accountService: AccountService,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /** Idempotently create a profile in response to the `user.registered` event. */
  async createProfileForUser(input: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
  }): Promise<void> {
    if (await this.profileRepository.findByUserId(input.userId)) {
      return;
    }
    try {
      await this.profileRepository.save(
        this.profileRepository.create({
          userId: input.userId,
          firstName: input.firstName,
          lastName: input.lastName,
        }),
      );
    } catch (error) {
      // Lost a race with another worker / lazy-create — the row now exists.
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  // --- self (/users/me) ------------------------------------------------------

  async getMe(userId: string): Promise<ProfileResponseDto> {
    const identity = await this.requireIdentity(userId);
    const profile = await this.ensureProfile(userId);
    return ProfileResponseDto.fromParts(identity, profile);
  }

  async updateMe(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const identity = await this.requireIdentity(userId);
    const profile = await this.ensureProfile(userId);
    Object.assign(profile, dto);
    const saved = await this.profileRepository.save(profile);
    return ProfileResponseDto.fromParts(identity, saved);
  }

  // --- addresses -------------------------------------------------------------

  async listAddresses(userId: string): Promise<AddressResponseDto[]> {
    const profile = await this.ensureProfile(userId);
    const addresses = await this.addressRepository.findByProfile(profile.id);
    return addresses.map((address) => AddressResponseDto.fromEntity(address));
  }

  /**
   * Cross-module (orders): a snapshot of one of the user's saved addresses, to
   * be copied immutably onto an order. 404 if the address isn't theirs.
   */
  async getAddressSnapshot(
    userId: string,
    addressId: string,
  ): Promise<AddressSnapshot> {
    const profile = await this.ensureProfile(userId);
    const address = await this.requireAddress(addressId, profile.id);
    return {
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    };
  }

  /**
   * Cross-module (notifications): resolve a user's contact points so callers can
   * pass a `to` into the dispatch seam without notifications importing auth/users
   * (no module cycle, D64). Email lives in `auth.account`; phone on the profile.
   */
  async getContactInfo(userId: string): Promise<ContactInfo> {
    const [identity, profile] = await Promise.all([
      this.accountService.getIdentity(userId),
      this.profileRepository.findByUserId(userId),
    ]);
    return {
      email: identity?.email ?? null,
      phone: profile?.phone ?? null,
    };
  }

  async createAddress(
    userId: string,
    dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    const profile = await this.ensureProfile(userId);
    const saved = await this.dataSource.transaction(async (manager) => {
      await this.clearDefaults(
        manager,
        profile.id,
        dto.isDefaultShipping,
        dto.isDefaultBilling,
      );
      return manager.save(
        manager.create(Address, { ...dto, profileId: profile.id }),
      );
    });
    return AddressResponseDto.fromEntity(saved);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    const profile = await this.ensureProfile(userId);
    const address = await this.requireAddress(addressId, profile.id);
    const saved = await this.dataSource.transaction(async (manager) => {
      await this.clearDefaults(
        manager,
        profile.id,
        dto.isDefaultShipping,
        dto.isDefaultBilling,
        addressId,
      );
      Object.assign(address, dto);
      return manager.save(address);
    });
    return AddressResponseDto.fromEntity(saved);
  }

  async removeAddress(userId: string, addressId: string): Promise<void> {
    const profile = await this.ensureProfile(userId);
    await this.requireAddress(addressId, profile.id);
    await this.addressRepository.softDelete(addressId);
  }

  async setDefaultAddress(
    userId: string,
    addressId: string,
    dto: SetDefaultAddressDto,
  ): Promise<AddressResponseDto> {
    const profile = await this.ensureProfile(userId);
    const address = await this.requireAddress(addressId, profile.id);
    const saved = await this.dataSource.transaction(async (manager) => {
      if (dto.shipping) {
        await this.clearDefaults(manager, profile.id, true, false, addressId);
        address.isDefaultShipping = true;
      }
      if (dto.billing) {
        await this.clearDefaults(manager, profile.id, false, true, addressId);
        address.isDefaultBilling = true;
      }
      return manager.save(address);
    });
    return AddressResponseDto.fromEntity(saved);
  }

  // --- admin -----------------------------------------------------------------

  async adminList(query: UserListQueryDto): Promise<{
    data: ProfileResponseDto[];
    pagination: PaginationMeta;
  }> {
    const { items, total } = await this.accountService.listAccounts(query);
    const profiles = await this.profileRepository.findByUserIds(
      items.map((identity) => identity.id),
    );
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
    return {
      data: items.map((identity) =>
        ProfileResponseDto.fromParts(
          identity,
          profileByUser.get(identity.id) ?? null,
        ),
      ),
      pagination: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  /** user id → display name (profile displayName or first+last); blanks omitted. */
  async displayNamesByIds(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const profiles = await this.profileRepository.findByUserIds(userIds);
    const map = new Map<string, string>();
    for (const p of profiles) {
      const name =
        p.displayName ??
        [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
      if (name) map.set(p.userId, name);
    }
    return map;
  }

  async adminGetById(userId: string): Promise<ProfileResponseDto> {
    const identity = await this.requireIdentity(userId);
    const profile = await this.profileRepository.findByUserId(userId);
    return ProfileResponseDto.fromParts(identity, profile);
  }

  async adminUpdateStatus(
    actorId: string,
    targetId: string,
    status: AccountStatus,
    ip?: string,
  ): Promise<AccountIdentity> {
    const target = await this.requireIdentity(targetId);
    if (TERMINAL_STATUSES.includes(status)) {
      await this.assertNotLastAdmin(target);
    }
    const updated = await this.accountService.updateStatus(targetId, status);
    await this.auditService.record({
      action: AuditAction.ACCOUNT_STATUS_CHANGED,
      actorId,
      targetType: 'account',
      targetId,
      ip,
      metadata: { status },
    });
    return updated;
  }

  async adminSetRoles(
    actorId: string,
    targetId: string,
    roles: Role[],
    ip?: string,
  ): Promise<AccountIdentity> {
    const target = await this.requireIdentity(targetId);
    if (target.roles.includes(Role.ADMIN) && !roles.includes(Role.ADMIN)) {
      await this.assertNotLastAdmin(target);
    }
    const updated = await this.accountService.setRoles(targetId, roles);
    await this.auditService.record({
      action: AuditAction.ACCOUNT_ROLES_CHANGED,
      actorId,
      targetType: 'account',
      targetId,
      ip,
      metadata: { roles },
    });
    return updated;
  }

  // --- helpers ---------------------------------------------------------------

  private async requireIdentity(userId: string): Promise<AccountIdentity> {
    const identity = await this.accountService.getIdentity(userId);
    if (!identity) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return identity;
  }

  /** Return the profile, lazily creating it if the registration event hasn't landed yet. */
  private async ensureProfile(userId: string): Promise<Profile> {
    const existing = await this.profileRepository.findByUserId(userId);
    if (existing) {
      return existing;
    }
    try {
      return await this.profileRepository.save(
        this.profileRepository.create({ userId }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const profile = await this.profileRepository.findByUserId(userId);
        if (profile) {
          return profile;
        }
      }
      throw error;
    }
  }

  private async requireAddress(
    addressId: string,
    profileId: string,
  ): Promise<Address> {
    const address = await this.addressRepository.findOneForProfile(
      addressId,
      profileId,
    );
    if (!address) {
      // 404 (not 403) so we never reveal another user's address ids.
      throw new NotFoundException(`Address ${addressId} not found`);
    }
    return address;
  }

  private async clearDefaults(
    manager: EntityManager,
    profileId: string,
    shipping?: boolean,
    billing?: boolean,
    exceptId?: string,
  ): Promise<void> {
    const where: FindOptionsWhere<Address> = exceptId
      ? { profileId, id: Not(exceptId) }
      : { profileId };
    if (shipping) {
      await manager.update(Address, where, { isDefaultShipping: false });
    }
    if (billing) {
      await manager.update(Address, where, { isDefaultBilling: false });
    }
  }

  private async assertNotLastAdmin(target: AccountIdentity): Promise<void> {
    if (
      target.roles.includes(Role.ADMIN) &&
      target.status === AccountStatus.ACTIVE &&
      (await this.accountService.countActiveAdmins()) <= 1
    ) {
      throw new ConflictException(
        'Cannot remove or suspend the last active admin',
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      (error as { driverError?: { code?: string } })?.driverError?.code ===
      '23505'
    );
  }
}
