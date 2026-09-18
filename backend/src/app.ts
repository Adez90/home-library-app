import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBookRoutes } from './routes/books.js';
import { registerSeriesRoutes } from './routes/series.js';
import { registerFavoriteRoutes } from './routes/favorites.js';

export function buildApp() {
  const app = Fastify({ logger: false });

  app.register(cookie);
  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    cookie: { cookieName: 'session', signed: false },
  });

  app.decorate('authenticate', async function authenticate(request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(registerAuthRoutes, { prefix: '/auth' });
  app.register(registerBookRoutes);
  app.register(registerSeriesRoutes);
  app.register(registerFavoriteRoutes);

  return app;
}
