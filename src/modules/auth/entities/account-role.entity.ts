import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Role } from '../../../common/enums/role.enum';
import { SCHEMA } from '../../../database/schemas';
import { Account } from './account.entity';

/**
 * Role assignment (M:N). An account may hold several roles (e.g. ADMIN +
 * INVENTORY_MANAGER); the JWT carries the full array.
 */
@Entity({ schema: SCHEMA.AUTH, name: 'account_role' })
@Index('uq_account_role', ['accountId', 'role'], { unique: true })
export class AccountRole extends BaseEntity {
  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, (account) => account.roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ type: 'varchar', length: 30 })
  role: Role;
}
