import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Role } from '../../../common/enums/role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { Account } from '../entities/account.entity';

@Injectable()
export class AccountRepository extends BaseRepository<Account> {
  constructor(
    @InjectRepository(Account)
    repo: Repository<Account>,
  ) {
    super(repo);
  }

  /** roles are eager-loaded; `findById` already includes them. */
  findByEmail(email: string): Promise<Account | null> {
    return this.findOne({ where: { email } });
  }

  /** Includes the hidden passwordHash + roles for credential verification. */
  findByEmailWithPassword(email: string): Promise<Account | null> {
    return this.repository
      .createQueryBuilder('account')
      .addSelect('account.passwordHash')
      .leftJoinAndSelect('account.roles', 'roles')
      .where('account.email = :email', { email })
      .getOne();
  }

  countActiveAdmins(): Promise<number> {
    return this.repository
      .createQueryBuilder('account')
      .innerJoin('account.roles', 'role')
      .where('role.role = :admin', { admin: Role.ADMIN })
      .andWhere('account.status = :status', { status: AccountStatus.ACTIVE })
      .getCount();
  }

  findPaginated(
    skip: number,
    take: number,
    role?: Role,
    status?: AccountStatus,
  ): Promise<[Account[], number]> {
    const qb = this.repository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.roles', 'accountRole')
      .orderBy('account.created_at', 'DESC')
      .skip(skip)
      .take(take);

    if (status) {
      qb.andWhere('account.status = :status', { status });
    }
    if (role) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM auth.account_role ar
                  WHERE ar.account_id = account.id AND ar.role = :role)`,
        { role },
      );
    }
    return qb.getManyAndCount();
  }
}
