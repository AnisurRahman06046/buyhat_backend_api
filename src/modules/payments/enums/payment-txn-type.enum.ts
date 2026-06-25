/** Kind of entry in the append-only payment_transaction ledger. */
export enum PaymentTxnType {
  CHARGE = 'CHARGE',
  CALLBACK = 'CALLBACK',
  WEBHOOK = 'WEBHOOK',
  REFUND = 'REFUND',
}
