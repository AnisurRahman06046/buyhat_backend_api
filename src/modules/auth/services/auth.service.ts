import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { NotificationEvent, NotificationService } from '../../notifications';
import { AuditAction, AuditService } from '../../audit';
import { AuthTokensDto } from '../dto/auth-tokens.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { Account } from '../entities/account.entity';
import { AccountRole } from '../entities/account-role.entity';
import { AccountStatus } from '../enums/account-status.enum';
import { OneTimeTokenPurpose } from '../enums/one-time-token-purpose.enum';
import { PASSWORD_HASHER, PasswordHasher } from './password-hasher';
import { AccountService } from './account.service';
import { OneTimeTokenService } from './one-time-token.service';
import { OutboxService } from './outbox.service';
import { OutboxRelayService } from './outbox-relay.service';
import { RefreshTokenStore } from './refresh-token.store';
import { TokenService } from './token.service';

const EMAIL_VERIFICATION_TTL = 24 * 60 * 60; // 24h
const PASSWORD_RESET_TTL = 60 * 60; // 1h
const TERMINAL_STATUSES = [AccountStatus.SUSPENDED, AccountStatus.DEACTIVATED];

/**
 * Authentication use-cases. Owns identity orchestration: registration (atomic
 * via the transactional outbox), login, refresh rotation, logout, email
 * verification, and password reset.
 */
@Injectable()
export class AuthService {
  private dummyHashPromise?: Promise<string>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly accountService: AccountService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly oneTimeTokenService: OneTimeTokenService,
    private readonly outboxService: OutboxService,
    private readonly outboxRelay: OutboxRelayService,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly notifications: NotificationService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ip?: string): Promise<AuthTokensDto> {
    const email = dto.email.toLowerCase();
    const passwordHash = await this.passwordHasher.hash(dto.password);

    // One transaction: account + CUSTOMER role + verification token + outbox
    // event. A duplicate email trips the unique index → 23505 → 409 (filter).
    const { accountId, verificationToken } = await this.dataSource.transaction(
      async (manager) => {
        const account = await manager.save(
          manager.create(Account, {
            email,
            passwordHash,
            status: AccountStatus.PENDING_VERIFICATION,
          }),
        );
        await manager.insert(AccountRole, {
          accountId: account.id,
          role: Role.CUSTOMER,
        });
        const verificationToken = await this.oneTimeTokenService.issue(
          account.id,
          OneTimeTokenPurpose.EMAIL_VERIFICATION,
          EMAIL_VERIFICATION_TTL,
          manager,
        );
        await this.outboxService.record(manager, {
          aggregateType: 'account',
          aggregateId: account.id,
          eventType: 'user.registered',
          payload: {
            userId: account.id,
            email,
            firstName: dto.firstName ?? null,
            lastName: dto.lastName ?? null,
          },
        });
        return { accountId: account.id, verificationToken };
      },
    );

    // Best-effort post-commit side effects (the poller recovers if these fail).
    void this.outboxRelay.flush();
    await this.notifications.dispatch({
      event: NotificationEvent.AUTH_VERIFY_EMAIL,
      userId: accountId,
      to: { email },
      data: { token: verificationToken },
    });
    await this.auditService.record({
      action: AuditAction.AUTH_REGISTER,
      actorId: accountId,
      targetType: 'account',
      targetId: accountId,
      ip,
    });

    return this.issueAndStore(accountId, email, [Role.CUSTOMER]);
  }

  async login(dto: LoginDto, ip?: string): Promise<AuthTokensDto> {
    const account = await this.accountService.findByEmailWithPassword(
      dto.email,
    );

    // Constant-time-ish: always run a verify (dummy hash when no account) so a
    // missing email is indistinguishable from a wrong password by timing.
    if (!account?.passwordHash) {
      await this.passwordHasher.verify(await this.getDummyHash(), dto.password);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await this.passwordHasher.verify(
      account.passwordHash,
      dto.password,
    );
    if (!passwordMatches || TERMINAL_STATUSES.includes(account.status)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Transparently upgrade the hash if the KDF params have since been raised.
    if (this.passwordHasher.needsRehash(account.passwordHash)) {
      await this.accountService.updatePasswordHash(
        account.id,
        await this.passwordHasher.hash(dto.password),
      );
    }

    await this.accountService.recordLogin(account.id);
    await this.auditService.record({
      action: AuditAction.AUTH_LOGIN,
      actorId: account.id,
      targetType: 'account',
      targetId: account.id,
      ip,
    });
    return this.issueAndStore(
      account.id,
      account.email,
      this.accountService.rolesOf(account),
    );
  }

  /**
   * Rotate a refresh token. Re-reads the account so a suspended/deactivated user
   * is cut off and role changes take effect (≤ refresh lifetime). Reuse of an
   * already-rotated token revokes the whole family.
   */
  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const payload = await this.verifyRefreshOrThrow(refreshToken);
    if (!payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const rotated = await this.refreshTokenStore.consume(
      payload.sub,
      payload.jti,
    );
    if (!rotated) {
      await this.refreshTokenStore.revokeAll(payload.sub);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const account = await this.accountService.findById(payload.sub);
    if (!account || TERMINAL_STATUSES.includes(account.status)) {
      await this.refreshTokenStore.revokeAll(payload.sub);
      throw new UnauthorizedException('Account is not active');
    }

    return this.issueAndStore(
      account.id,
      account.email,
      this.accountService.rolesOf(account),
    );
  }

  async logout(refreshToken: string): Promise<{ revoked: boolean }> {
    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      if (payload.jti) {
        await this.refreshTokenStore.consume(payload.sub, payload.jti);
      }
    } catch {
      // Idempotent — an invalid/expired token is already "logged out".
    }
    return { revoked: true };
  }

  async verifyEmail(token: string): Promise<{ verified: boolean }> {
    const accountId = await this.oneTimeTokenService.consume(
      token,
      OneTimeTokenPurpose.EMAIL_VERIFICATION,
    );
    if (!accountId) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.accountService.markEmailVerified(accountId);
    return { verified: true };
  }

  async resendVerification(userId: string): Promise<{ sent: boolean }> {
    const account = await this.accountService.getByIdOrThrow(userId);
    if (account.emailVerifiedAt) {
      throw new ConflictException('Email already verified');
    }
    await this.oneTimeTokenService.invalidateAll(
      userId,
      OneTimeTokenPurpose.EMAIL_VERIFICATION,
    );
    const token = await this.oneTimeTokenService.issue(
      userId,
      OneTimeTokenPurpose.EMAIL_VERIFICATION,
      EMAIL_VERIFICATION_TTL,
    );
    await this.notifications.dispatch({
      event: NotificationEvent.AUTH_VERIFY_EMAIL,
      userId,
      to: { email: account.email },
      data: { token },
    });
    return { sent: true };
  }

  /** Always returns `{ sent: true }` regardless of whether the email exists (no enumeration). */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ sent: boolean }> {
    const account = await this.accountService.findByEmail(dto.email);
    if (account) {
      await this.oneTimeTokenService.invalidateAll(
        account.id,
        OneTimeTokenPurpose.PASSWORD_RESET,
      );
      const token = await this.oneTimeTokenService.issue(
        account.id,
        OneTimeTokenPurpose.PASSWORD_RESET,
        PASSWORD_RESET_TTL,
      );
      await this.notifications.dispatch({
        event: NotificationEvent.AUTH_PASSWORD_RESET,
        userId: account.id,
        to: { email: account.email },
        data: { token },
      });
    }
    return { sent: true };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    ip?: string,
  ): Promise<{ reset: boolean }> {
    const accountId = await this.oneTimeTokenService.consume(
      dto.token,
      OneTimeTokenPurpose.PASSWORD_RESET,
    );
    if (!accountId) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    await this.accountService.updatePasswordHash(
      accountId,
      await this.passwordHasher.hash(dto.newPassword),
    );
    // Log out every session on a credential change.
    await this.refreshTokenStore.revokeAll(accountId);
    await this.auditService.record({
      action: AuditAction.AUTH_PASSWORD_RESET,
      actorId: accountId,
      targetType: 'account',
      targetId: accountId,
      ip,
    });
    return { reset: true };
  }

  /** Issue a token pair and register the refresh token as a live session. */
  private async issueAndStore(
    userId: string,
    email: string,
    roles: Role[],
  ): Promise<AuthTokensDto> {
    const issued = await this.tokenService.issueTokens(userId, email, roles);
    await this.refreshTokenStore.add(
      userId,
      issued.jti,
      issued.refreshTtlSeconds,
    );
    return issued.tokens;
  }

  private async verifyRefreshOrThrow(token: string): Promise<JwtPayload> {
    try {
      return await this.tokenService.verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /** Lazily-computed constant hash used to equalise login timing for missing accounts. */
  private getDummyHash(): Promise<string> {
    return (this.dummyHashPromise ??= this.passwordHasher.hash(
      'timing-equalisation-dummy-password',
    ));
  }
}
