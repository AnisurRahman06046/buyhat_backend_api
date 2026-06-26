/**
 * Sales report time bucket. Values are valid Postgres `date_trunc` units and are
 * whitelisted (never raw input), so they are safe to interpolate.
 */
export enum SalesGranularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}
