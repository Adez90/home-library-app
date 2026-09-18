import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { getPrimaryHouseholdId } from '../lib/household.js';

const addFavoriteSchema = z.object({
  targetType: z.enum(['author', 'series']),
  targetId: z.string().uuid(),
});

async function resolveName(targetType: 'author' | 'series', targetId: string) {
  if (targetType === 'author') {
    const author = await prisma.author.findUnique({ where: { id: targetId } });
    return author?.name;
  }
  const series = await prisma.series.findUnique({ where: { id: targetId } });
  return series?.name;
}

export async function registerFavoriteRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.post('/favorites', async (request, reply) => {
    const parsed = addFavoriteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { targetType, targetId } = parsed.data;
    const householdId = await getPrimaryHouseholdId(request.user.userId);

    const name = await resolveName(targetType, targetId);
    if (!name) {
      return reply.code(404).send({ error: `No ${targetType} found with that id` });
    }

    try {
      const favorite = await prisma.favorite.create({ data: { householdId, targetType, targetId } });
      return reply.code(201).send({ id: favorite.id, targetType, targetId, name });
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
      favorites.map(async (favorite) => ({
        id: favorite.id,
        targetType: favorite.targetType,
        targetId: favorite.targetId,
        name: await resolveName(favorite.targetType as 'author' | 'series', favorite.targetId),
      })),
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
