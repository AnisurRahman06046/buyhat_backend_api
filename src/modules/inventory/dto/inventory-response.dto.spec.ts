import { StockItem } from '../entities/stock-item.entity';
import { StockAvailabilityDto } from './inventory-response.dto';

const item = (onHand: number, reserved: number, reorder: number): StockItem =>
  Object.assign(new StockItem(), {
    variantId: 'v1',
    quantityOnHand: onHand,
    quantityReserved: reserved,
    reorderLevel: reorder,
  });

describe('StockAvailabilityDto', () => {
  it('computes available = on_hand − reserved', () => {
    const dto = StockAvailabilityDto.fromEntity(item(10, 3, 2));
    expect(dto.available).toBe(7);
    expect(dto.lowStock).toBe(false);
  });

  it('flags lowStock when available ≤ reorder level', () => {
    const dto = StockAvailabilityDto.fromEntity(item(5, 3, 2));
    expect(dto.available).toBe(2);
    expect(dto.lowStock).toBe(true);
  });

  it('treats a missing stock item as all-zero and low', () => {
    const dto = StockAvailabilityDto.empty('v2');
    expect(dto).toMatchObject({
      variantId: 'v2',
      onHand: 0,
      reserved: 0,
      available: 0,
      lowStock: true,
    });
  });
});
