import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';

describe('auth', () => {
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
  });

  it('registers a new user and creates a household', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'anna@example.com', password: 'password123', name: 'Anna' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe('anna@example.com');
    expect(body.household.role).toBe('owner');
    expect(body.household.inviteCode).toHaveLength(8);
    expect(res.cookies.some((c) => c.name === 'session')).toBe(true);
  });

  it('rejects registering the same email twice', async () => {
    const payload = { email: 'dup@example.com', password: 'password123', name: 'Dup' };

    const first = await app.inject({ method: 'POST', url: '/auth/register', payload });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({ method: 'POST', url: '/auth/register', payload });
    expect(second.statusCode).toBe(409);
  });

  it('lets a second person join the same household via invite code', async () => {
    const owner = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'owner@example.com', password: 'password123', name: 'Owner' },
    });
    const inviteCode = owner.json().household.inviteCode;

    const member = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'member@example.com', password: 'password123', name: 'Member', inviteCode },
    });

    expect(member.statusCode).toBe(201);
    const body = member.json();
    expect(body.household.id).toBe(owner.json().household.id);
    expect(body.household.role).toBe('member');
  });

  it('rejects an unknown invite code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'nope@example.com', password: 'password123', name: 'Nope', inviteCode: 'BADCODE' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('logs in with correct credentials and rejects a wrong password', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'login@example.com', password: 'password123', name: 'Login' },
    });

    const good = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login@example.com', password: 'password123' },
    });
    expect(good.statusCode).toBe(200);

    const bad = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login@example.com', password: 'wrong' },
    });
    expect(bad.statusCode).toBe(401);
  });

  it('rejects /me without a session and accepts it with one', async () => {
    const anon = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(anon.statusCode).toBe(401);

    const registered = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'me@example.com', password: 'password123', name: 'Me' },
    });
    const sessionCookie = registered.cookies.find((c) => c.name === 'session');

    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      cookies: { session: sessionCookie!.value },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe('me@example.com');
  });

  describe('REGISTRATION_SECRET gate', () => {
    afterEach(() => {
      delete process.env.REGISTRATION_SECRET;
    });

    it('rejects a new household without the secret when one is configured', async () => {
      process.env.REGISTRATION_SECRET = 'letmein';

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'stranger@example.com', password: 'password123', name: 'Stranger' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('accepts a new household when the secret matches', async () => {
      process.env.REGISTRATION_SECRET = 'letmein';

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'owner2@example.com',
          password: 'password123',
          name: 'Owner',
          registrationSecret: 'letmein',
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('still lets someone join an existing household by invite code without the secret', async () => {
      const owner = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'owner3@example.com', password: 'password123', name: 'Owner' },
      });
      const inviteCode = owner.json().household.inviteCode;

      process.env.REGISTRATION_SECRET = 'letmein';

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'joiner@example.com', password: 'password123', name: 'Joiner', inviteCode },
      });

      expect(res.statusCode).toBe(201);
    });
  });
});
