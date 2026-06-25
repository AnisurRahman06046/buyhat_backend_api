/** Lifecycle of a stock reservation: HELD → (CONFIRMED→sold | RELEASED | EXPIRED). */
export enum ReservationStatus {
  HELD = 'HELD',
  CONFIRMED = 'CONFIRMED',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
}
