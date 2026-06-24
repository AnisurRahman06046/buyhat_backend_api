import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants';

/** Marks a route as publicly accessible (bypasses the global JwtAuthGuard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
