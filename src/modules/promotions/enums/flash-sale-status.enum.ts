/** Flash-sale lifecycle, driven by its time window (sweeper-maintained). */
export enum FlashSaleStatus {
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
}
