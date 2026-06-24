import { Column, Entity, Index, OneToMany } from 'typeorm';
import { AuditableEntity } from '../../../common/entities/auditable.entity';
import { SCHEMA } from '../../../database/schemas';
import { Address } from './address.entity';

/**
 * Customer profile. `user_id` is a logical 1:1 to `auth.account.id` (no
 * cross-schema FK). Email is NOT stored here — it lives only in `auth.account`.
 */
@Entity({ schema: SCHEMA.USERS, name: 'profile' })
@Index('uq_profile_user', ['userId'], { unique: true })
@Index('uq_profile_phone_active', ['phone'], {
  unique: true,
  where: '"phone" IS NOT NULL AND "deleted_at" IS NULL',
})
export class Profile extends AuditableEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName: string | null;

  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  displayName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  locale: string;

  @Column({ type: 'char', length: 3, default: 'BDT' })
  currency: string;

  @Column({ name: 'marketing_opt_in', type: 'boolean', default: false })
  marketingOptIn: boolean;

  @Column({ type: 'jsonb', default: {} })
  preferences: Record<string, unknown>;

  @OneToMany(() => Address, (address) => address.profile)
  addresses: Address[];
}
