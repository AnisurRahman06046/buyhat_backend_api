import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or whole controller) as publicly accessible, bypassing the
 * globally-registered JwtAuthGuard. Usage: `@Public()`.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
