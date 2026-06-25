/** Lifecycle of a cart. */
export enum CartStatus {
  ACTIVE = 'ACTIVE', // in use
  MERGED = 'MERGED', // folded into another cart on login
  CONVERTED = 'CONVERTED', // turned into an order (Phase 5)
  ABANDONED = 'ABANDONED', // inactive past the threshold (D23)
}
