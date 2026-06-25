/**
 * Every quantity change writes a `stock_movement` of one of these types
 * (append-only ledger — edge case #9). `quantity` is a signed delta.
 */
export enum StockMovementType {
  IN = 'IN', // received stock
  OUT = 'OUT', // removed (non-sale)
  RESERVE = 'RESERVE', // held for a cart/order
  RELEASE = 'RELEASE', // hold released (manual / payment failure)
  ADJUST = 'ADJUST', // manual correction
  SALE = 'SALE', // reservation confirmed → sold
  RETURN = 'RETURN', // customer return back to stock
  DAMAGE = 'DAMAGE', // written off as damaged
}
