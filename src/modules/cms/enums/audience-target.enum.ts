/** Who a popup targets; the server filters by the caller's auth state (D50). */
export enum AudienceTarget {
  GUESTS = 'GUESTS',
  LOGGED_IN = 'LOGGED_IN',
  EVERYONE = 'EVERYONE',
}
