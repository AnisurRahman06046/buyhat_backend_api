import { Module } from '@nestjs/common';

/**
 * Reviews module — product ratings and reviews, including moderation state.
 * Owns schema `reviews`. References products and users by id only (via their
 * services), never by cross-schema foreign keys.
 *
 * Skeleton only.
 */
@Module({})
export class ReviewsModule {}
