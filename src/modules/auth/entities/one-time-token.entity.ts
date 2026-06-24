import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { Account } from './account.entity';
import { OneTimeTokenPurpose } from '../enums/one-time-token-purpose.enum';

/**
 * Single-use token for email verification, password reset, or OTP login. Only
 * the SHA-256 `token_hash` is stored (never the raw value); checked for
 * unexpired + unconsumed before use.
 */
@Entity({ schema: SCHEMA.AUTH, name: 'one_time_token' })
@Index(['accountId', 'purpose'])
export class OneTimeToken extends BaseEntity {
  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ type: 'varchar', length: 30 })
  purpose: OneTimeTokenPurpose;

  @Index('uq_one_time_token_hash', ['tokenHash'], { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 128 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;
}
