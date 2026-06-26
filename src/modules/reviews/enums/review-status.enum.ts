/** Moderation lifecycle of a review. Only APPROVED reviews are public. */
export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
