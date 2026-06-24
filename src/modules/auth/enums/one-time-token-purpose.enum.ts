/**
 * Purpose of a single-use token. One unified table handles all three rather than
 * three near-identical tables.
 */
export enum OneTimeTokenPurpose {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  OTP_LOGIN = 'OTP_LOGIN',
}
