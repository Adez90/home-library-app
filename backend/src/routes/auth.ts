import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { generateInviteCode } from '../lib/invite.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  householdName: z.string().min(1).optional(),
  inviteCode: z.string().min(4).optional(),
  registrationSecret: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function cookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function toPublicUser(user: { id: string; email: string; name: string }) {
  return { id: user.id, email: user.email, name: user.name };
}

async function loadHouseholdsForUser(userId: string) {
  const memberships = await prisma.householdMember.findMany({
    where: { userId },
    include: { household: true },
  });
  return memberships.map((m) => ({
    id: m.household.id,
    name: m.household.name,
    role: m.role,
    inviteCode: m.household.inviteCode,
  }));
}

class InviteCodeNotFound extends Error {}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/register', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { email, password, name, householdName, inviteCode, registrationSecret } = parsed.data;

    // Anyone can join an existing household with its own invite code (that's the point of
    // invite codes). Starting a brand-new household is the thing worth gating on a server
    // exposed to the internet — REGISTRATION_SECRET, when set, is required for that path.
    const requiredSecret = process.env.REGISTRATION_SECRET;
    if (!inviteCode && requiredSecret && registrationSecret !== requiredSecret) {
      return reply.code(403).send({ error: 'Registration is invite-only on this server' });
    }

    const passwordHash = await hashPassword(password);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, passwordHash, name },
        });

        let household;
        let role: string;

        if (inviteCode) {
          household = await tx.household.findUnique({ where: { inviteCode } });
          if (!household) {
            throw new InviteCodeNotFound();
          }
          role = 'member';
        } else {
          household = await tx.household.create({
            data: {
              name: householdName ?? `${name}'s library`,
              inviteCode: generateInviteCode(),
            },
          });
          role = 'owner';
        }

        await tx.householdMember.create({
          data: { userId: user.id, householdId: household.id, role },
        });

        return { user, household, role };
      });

      const token = app.jwt.sign({ userId: result.user.id });
      reply.setCookie(SESSION_COOKIE, token, cookieOptions());

      return reply.code(201).send({
        user: toPublicUser(result.user),
        household: { id: result.household.id, name: result.household.name, role: result.role, inviteCode: result.household.inviteCode },
      });
    } catch (err) {
      if (err instanceof InviteCodeNotFound) {
        return reply.code(400).send({ error: 'Invite code not found' });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.code(409).send({ error: 'Email already registered' });
      }
      throw err;
    }
  });

  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const token = app.jwt.sign({ userId: user.id });
    reply.setCookie(SESSION_COOKIE, token, cookieOptions());

    return reply.send({
      user: toPublicUser(user),
      households: await loadHouseholdsForUser(user.id),
    });
  });

  app.post('/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.userId } });
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    return reply.send({
      user: toPublicUser(user),
      households: await loadHouseholdsForUser(user.id),
    });
  });
}
