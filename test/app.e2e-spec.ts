import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Smoke test. Booting AppModule establishes the real Postgres + Redis
 * connections, so this requires the infrastructure to be up (e.g.
 * `docker compose up -d postgres redis`). The liveness probe is @Public and
 * excluded from the global prefix, so it is reachable at `/health/live`.
 */
describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health/live (GET) returns ok', () => {
    return request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect((res) => {
        const body = res.body as { data?: { status?: string } };
        if (body.data?.status !== 'ok') {
          throw new Error(`Unexpected body: ${JSON.stringify(res.body)}`);
        }
      });
  });
});
