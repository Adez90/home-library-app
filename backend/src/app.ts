import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBookRoutes } from './routes/books.js';
import { registerSeriesRoutes } from './routes/series.js';
import { registerFavoriteRoutes } from './routes/favorites.js';

const JWT_MAX_AGE = '30d';

function requiredJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production — refusing to start with a default secret.');
    }
    return 'dev-only-secret-not-for-production';
  }
  return secret;
}

export function buildApp() {
  const app = Fastify({ logger: false });

  app.register(helmet);
  // A generous baseline against blunt abuse; auth routes get a much tighter limit below.
  // Skipped in tests: they legitimately exercise many auth calls in quick succession and
  // don't represent real traffic from one client.
  if (process.env.NODE_ENV !== 'test') {
    app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  }

  app.register(cookie);
  app.register(jwt, {
    secret: requiredJwtSecret(),
    sign: { expiresIn: JWT_MAX_AGE },
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
