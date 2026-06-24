import { Module } from '@nestjs/common';

/**
 * Auth module — authentication, JWT access/refresh issuance, password
 * hashing, and the Passport 'jwt' strategy that the global JwtAuthGuard
 * relies on. Persistence (sessions/refresh tokens) lives in schema `auth`.
 *
 * Skeleton only: controllers/services/strategies are added as features land.
 */
@Module({})
export class AuthModule {}
