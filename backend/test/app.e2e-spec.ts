import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { HealthModule } from '../src/modules/health/health.module';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  function getHttpServer(application: INestApplication): App {
    return application.getHttpServer() as App;
  }

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return request(getHttpServer(app))
      .get('/health')
      .expect(200)
      .expect(({ body }: { body: { status: string; timestamp: string } }) => {
        expect(body.status).toBe('ok');
        expect(typeof body.timestamp).toBe('string');
      });
  });
});
