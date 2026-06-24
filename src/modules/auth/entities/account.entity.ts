import { Column, Entity, Index, OneToMany } from 'typeorm';
import { AuditableEntity } from '../../../common/entities/auditable.entity';
import { SCHEMA } from '../../../database/schemas';
import { AccountStatus } from '../enums/account-status.enum';
import { AccountRole } from './account-role.entity';

/**
 * Identity + credentials aggregate. Owns email, password, status and roles.
 * `account.id` is the GLOBAL user id (JWT `sub`) every other module references
 * logically. Profile data lives in the `users` module (no email duplication).
 */
@Entity({ schema: SCHEMA.AUTH, name: 'account' })
// email is unique only among live rows (partial), so a soft-deleted account's
// address can be reused. The DB column is `citext` → case-insensitive uniqueness.
@Index('uq_account_email_active', ['email'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Account extends AuditableEntity {
  @Column({ type: 'varchar', length: 320 })
  email: string;

  /** Argon2id hash — NEVER plaintext. Nullable to allow social login later. */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    select: false,
    nullable: true,
  })
  passwordHash: string | null;

  @Column({
    type: 'varchar',
    length: 30,
    default: AccountStatus.PENDING_VERIFICATION,
  })
  status: AccountStatus;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @OneToMany(() => AccountRole, (accountRole) => accountRole.account, {
    cascade: true,
    eager: true,
  })
  roles: AccountRole[];
}
