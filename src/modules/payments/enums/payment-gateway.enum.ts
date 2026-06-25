/**
 * Supported payment gateways. Real BD gateways (bKash/Nagad/Rocket/SSLCommerz/
 * ShurjoPay) drop in behind the `PAYMENT_GATEWAY` port; `MOCK` is a dev/test
 * online gateway; `COD` is cash-on-delivery.
 */
export enum PaymentGateway {
  BKASH = 'BKASH',
  NAGAD = 'NAGAD',
  ROCKET = 'ROCKET',
  SSLCOMMERZ = 'SSLCOMMERZ',
  SHURJOPAY = 'SHURJOPAY',
  COD = 'COD',
  MOCK = 'MOCK',
}
