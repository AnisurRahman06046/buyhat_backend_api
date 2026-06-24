import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { Account } from '../entities/account.entity';
import { AccountRole } from '../entities/account-role.entity';
import { AccountStatus } from '../enums/account-status.enum';
import { AccountRepository } from '../repositories/account.repository';

/**
 * Plain, outward-facing identity view. The `users` module consumes this instead
 * of the `Account` entity, so module boundaries hold (no cross-module entity import).
 */
export interface AccountIdentity {
  id: string;
  email: string;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  roles: Role[];
  createdAt: Date;
}

/**
 * Persistence + queries for the identity aggregate. Use-case orchestration
 * (register/login/reset …) lives in {@link AuthService}; this service is the
 * read/write API other concerns (and the `users` module) depend on.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly dataSource: DataSource,
  ) {}

  /** roles are eager-loaded. */
  findById(id: string): Promise<Account | null> {
    return this.accountRepository.findById(id);
  }

  async getByIdOrThrow(id: string): Promise<Account> {
    const account = await this.accountRepository.findById(id);
    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }
    return account;
  }

  findByEmail(email: string): Promise<Account | null> {
    return this.accountRepository.findByEmail(email.toLowerCase());
  }

  findByEmailWithPassword(email: string): Promise<Account | null> {
    return this.accountRepository.findByEmailWithPassword(email.toLowerCase());
  }

  rolesOf(account: Account): Role[] {
    return (account.roles ?? []).map((accountRole) => accountRole.role);
  }

  toIdentity(account: Account): AccountIdentity {
    return {
      id: account.id,
      email: account.email,
      status: account.status,
      emailVerifiedAt: account.emailVerifiedAt,
      lastLoginAt: account.lastLoginAt,
      roles: this.rolesOf(account),
      createdAt: account.createdAt,
    };
  }

  async getIdentity(id: string): Promise<AccountIdentity | null> {
    const account = await this.accountRepository.findById(id);
    return account ? this.toIdentity(account) : null;
  }

  async listAccounts(params: {
    page: number;
    limit: number;
    role?: Role;
    status?: AccountStatus;
  }): Promise<{ items: AccountIdentity[]; total: number }> {
    const skip = (params.page - 1) * params.limit;
    const [accounts, total] = await this.accountRepository.findPaginated(
      skip,
      params.limit,
      params.role,
      params.status,
    );
    return {
      items: accounts.map((account) => this.toIdentity(account)),
      total,
    };
  }

  countActiveAdmins(): Promise<number> {
    return this.accountRepository.countActiveAdmins();
  }

  async recordLogin(id: string): Promise<void> {
    await this.accountRepository.manager.update(Account, id, {
      lastLoginAt: new Date(),
    });
  }

  /** Mark email verified; promote PENDING_VERIFICATION → ACTIVE (never reactivates a suspended account). */
  async markEmailVerified(id: string): Promise<void> {
    await this.accountRepository.manager.update(Account, id, {
      emailVerifiedAt: new Date(),
    });
    await this.accountRepository.manager.update(
      Account,
      { id, status: AccountStatus.PENDING_VERIFICATION },
      { status: AccountStatus.ACTIVE },
    );
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.accountRepository.manager.update(Account, id, { passwordHash });
  }

  async updateStatus(
    id: string,
    status: AccountStatus,
  ): Promise<AccountIdentity> {
    await this.getByIdOrThrow(id);
    await this.accountRepository.manager.update(Account, id, { status });
    return this.toIdentity(await this.getByIdOrThrow(id));
  }

  /** Replace an account's roles atomically (delete + insert in one transaction). */
  async setRoles(id: string, roles: Role[]): Promise<AccountIdentity> {
    await this.getByIdOrThrow(id);
    const unique = [...new Set(roles)];
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AccountRole, { accountId: id });
      if (unique.length > 0) {
        await manager.insert(
          AccountRole,
          unique.map((role) => ({ accountId: id, role })),
        );
      }
    });
    return this.toIdentity(await this.getByIdOrThrow(id));
  }
}
