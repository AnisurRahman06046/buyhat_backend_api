import { ValueTransformer } from 'typeorm';

/**
 * TypeORM returns `numeric`/`decimal` columns as strings (to avoid float
 * precision loss). This transformer converts them to `number` on read while
 * leaving the value untouched on write, so money columns behave as numbers in
 * application code.
 *
 * Usage:
 *   @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
 *   price: number;
 */
export const moneyTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => value,
  from: (value?: string | null): number | null | undefined =>
    value === null || value === undefined ? value : parseFloat(value),
};
