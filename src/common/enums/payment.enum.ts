/** Payment gateways supported by BuyHat (Bangladesh market). */
export enum PaymentMethod {
  BKASH = 'BKASH',
  NAGAD = 'NAGAD',
  ROCKET = 'ROCKET',
  SSLCOMMERZ = 'SSLCOMMERZ',
  SHURJOPAY = 'SHURJOPAY',
  COD = 'COD',
  // Future: STRIPE, PAYPAL
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  INITIATED = 'INITIATED',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}
