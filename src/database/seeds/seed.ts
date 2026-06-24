import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { Algorithm, hash } from '@node-rs/argon2';
import { DataSource } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { AccountRole } from '../../modules/auth/entities/account-role.entity';
import { Account } from '../../modules/auth/entities/account.entity';
import { AccountStatus } from '../../modules/auth/enums/account-status.enum';
import { Profile } from '../../modules/users/entities/profile.entity';
import { dataSourceOptions } from '../data-source';

/**
 * Idempotent database seeder. Run AFTER migrations:
 *   npm run migration:run && npm run seed
 */
loadEnv();

/** First administrator (account + ADMIN role + profile), from ADMIN_EMAIL / ADMIN_PASSWORD. */
async function seedAdmin(dataSource: DataSource): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@buyhat.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.warn('[seed] ADMIN_PASSWORD not set — skipping admin seed.');
    return;
  }

  if (await dataSource.getRepository(Account).findOne({ where: { email } })) {
    console.log(`[seed] admin "${email}" already exists — skipping.`);
    return;
  }

  const passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  await dataSource.transaction(async (manager) => {
    const account = await manager.save(
      manager.create(Account, {
        email,
        passwordHash,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      }),
    );
    await manager.insert(AccountRole, {
      accountId: account.id,
      role: Role.ADMIN,
    });
    await manager.insert(Profile, { userId: account.id, firstName: 'Admin' });
  });

  console.log(`[seed] created admin "${email}".`);
}

async function run(): Promise<void> {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  try {
    await seedAdmin(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
