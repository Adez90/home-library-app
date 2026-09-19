import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { getPrimaryHouseholdId } from '../lib/household.js';
import { findOrCreateAuthor, findOrCreateSeries, getAuthorOwnedCount, getSeriesCompletion } from '../lib/catalog.js';

const addFavoriteSchema = z
  .object({
    targetType: z.enum(['author', 'series']),
    targetId: z.string().uuid().optional(),
    name: z.string().min(1).optional(),
  })
  .refine((data) => data.targetId || data.name, { message: 'Provide either targetId or name' });

async function resolveName(targetType: 'author' | 'series', targetId: string) {
  if (targetType === 'author') {
    const author = await prisma.author.findUnique({ where: { id: targetId } });
    return author?.name;
  }
  const series = await prisma.series.findUnique({ where: { id: targetId } });
  return series?.name;
}

async function withStats(
  householdId: string,
  targetType: 'author' | 'series',
  targetId: string,
  name: string,
): Promise<{ name: string; ownedCount: number; totalCount?: number }> {
  if (targetType === 'author') {
    return { name, ownedCount: await getAuthorOwnedCount(householdId, targetId) };
  }
  const { ownedCount, totalCount } = await getSeriesCompletion(householdId, targetId);
  return { name, ownedCount, totalCount };
}

export async function registerFavoriteRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.post('/favorites', async (request, reply) => {
    const parsed = addFavoriteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { targetType, name: givenName } = parsed.data;
    const householdId = await getPrimaryHouseholdId(request.user.userId);

    let targetId = parsed.data.targetId;
    let name: string | undefined;

    if (targetId) {
      name = await resolveName(targetType, targetId);
      if (!name) {
        return reply.code(404).send({ error: `No ${targetType} found with that id` });
      }
    } else {
      // No existing book/series needed — favoriting an author or series you don't own
      // anything from yet is exactly the point of a "look for" list.
      const trimmedName = givenName!.trim();
      const target = await prisma.$transaction((tx) =>
        targetType === 'author' ? findOrCreateAuthor(tx, trimmedName) : findOrCreateSeries(tx, trimmedName),
      );
      targetId = target.id;
      name = target.name;
    }

    try {
      const favorite = await prisma.favorite.create({ data: { householdId, targetType, targetId } });
      const stats = await withStats(householdId, targetType, targetId, name);
      return reply.code(201).send({ id: favorite.id, targetType, targetId, ...stats });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.code(409).send({ error: 'Already a favorite' });
      }
      throw err;
    }
  });

  app.get('/favorites', async (request) => {
    const householdId = await getPrimaryHouseholdId(request.user.userId);
    const favorites = await prisma.favorite.findMany({ where: { householdId }, orderBy: { createdAt: 'desc' } });

    return Promise.all(
      favorites.map(async (favorite) => {
        const targetType = favorite.targetType as 'author' | 'series';
        const name = (await resolveName(targetType, favorite.targetId)) ?? '(deleted)';
        const stats = await withStats(householdId, targetType, favorite.targetId, name);
        return { id: favorite.id, targetType, targetId: favorite.targetId, ...stats };
      }),
    );
  });

  app.delete('/favorites/:id', async (request, reply) => {
    const householdId = await getPrimaryHouseholdId(request.user.userId);
    const { id } = request.params as { id: string };

    const existing = await prisma.favorite.findFirst({ where: { id, householdId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Not found' });
    }

    await prisma.favorite.delete({ where: { id } });
    return reply.code(204).send();
  });
}
