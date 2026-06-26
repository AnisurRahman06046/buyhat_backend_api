import { Column, Entity, Index, OneToMany } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';
import { FlashSaleStatus } from '../enums/flash-sale-status.enum';
import { FlashSaleItem } from './flash-sale-item.entity';

/** A time-boxed sale; `status` is maintained by the sweeper, pricing uses the window. */
@Entity({ schema: SCHEMA.PROMOTIONS, name: 'flash_sale' })
@Index(['status', 'startsAt', 'endsAt'])
export class FlashSale extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @Column({ type: 'varchar', length: 20, default: FlashSaleStatus.SCHEDULED })
  status: FlashSaleStatus;

  @OneToMany(() => FlashSaleItem, (item) => item.flashSale)
  items: FlashSaleItem[];
}
