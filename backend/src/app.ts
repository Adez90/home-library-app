import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBookRoutes } from './routes/books.js';
import { registerSeriesRoutes } from './routes/series.js';
import { registerFavoriteRoutes } from './routes/favorites.js';
import { captureException } from './lib/sentry.js';

const JWT_MAX_AGE = '30d';

// Structured logging via Fastify's built-in pino instance — this used to be `logger: false`,
// which meant zero visibility into requests or errors on a deployed server. Off in tests only:
// tests legitimately trigger a lot of expected 4xx/error paths and don't need that noise.
function loggerConfig() {
  if (process.env.NODE_ENV === 'test') return false;
  const isProd = process.env.NODE_ENV === 'production';
  return {
    level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
    // Pretty-printed in dev for a human reading a terminal; plain JSON in prod, which is what
    // log aggregators (docker logs, journald, etc.) want to ingest.
    transport: isProd ? undefined : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
    // Never let a session cookie or bearer token end up in a log line.
    redact: {
      paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
  };
}

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
  const app = Fastify({ logger: loggerConfig() });

  app.addHook('onError', async (_request, _reply, error) => {
    captureException(error);
  });

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
