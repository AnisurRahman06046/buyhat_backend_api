import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';
import { Profile } from './profile.entity';

/**
 * A shipping/billing address belonging to a profile. Two partial-unique indexes
 * enforce at most one default-shipping and one default-billing per profile.
 */
@Entity({ schema: SCHEMA.USERS, name: 'address' })
@Index('uq_address_default_shipping', ['profileId'], {
  unique: true,
  where: '"is_default_shipping" = true AND "deleted_at" IS NULL',
})
@Index('uq_address_default_billing', ['profileId'], {
  unique: true,
  where: '"is_default_billing" = true AND "deleted_at" IS NULL',
})
export class Address extends SoftDeletableEntity {
  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  @ManyToOne(() => Profile, (profile) => profile.addresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ type: 'varchar', length: 50, nullable: true })
  label: string | null;

  @Column({ name: 'recipient_name', type: 'varchar', length: 150 })
  recipientName: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'line1', type: 'varchar', length: 255 })
  line1: string;

  @Column({ name: 'line2', type: 'varchar', length: 255, nullable: true })
  line2: string | null;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode: string | null;

  @Column({ type: 'char', length: 2, default: 'BD' })
  country: string;

  @Column({ name: 'is_default_shipping', type: 'boolean', default: false })
  isDefaultShipping: boolean;

  @Column({ name: 'is_default_billing', type: 'boolean', default: false })
  isDefaultBilling: boolean;
}
