import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

// Rate limiting is disabled in the normal test env (NODE_ENV=test, see vitest.config.ts) so
// the rest of the suite can register/log in many times quickly without tripping it. This file
// builds its own app instance with rate limiting turned on, the same way it runs outside tests.
// That also turns the request logger on (off only for NODE_ENV=test) — silenced here so this
// test's deliberate non-test-env simulation doesn't spam CI output.
process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = 'silent';

const { buildApp } = await import('../src/app.js');
const { prisma } = await import('../src/db.js');

describe('login rate limiting', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterEach(async () => {
    await prisma.householdMember.deleteMany();
    await prisma.household.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    process.env.NODE_ENV = 'test';
    delete process.env.LOG_LEVEL;
  });

  it('locks out further login attempts after the limit is hit', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'ratelimited@example.com', password: 'password123', name: 'Rate' },
    });

    const attempts = await Promise.all(
      Array.from({ length: 15 }, () =>
        app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: 'ratelimited@example.com', password: 'wrong' },
        }),
      ),
    );

    const statusCodes = attempts.map((r) => r.statusCode);
    expect(statusCodes).toContain(429);
    expect(statusCodes.filter((c) => c === 401).length).toBeLessThan(15);
  });
});
