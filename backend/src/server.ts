import { buildApp } from './app.js';
import { initSentry, captureException } from './lib/sentry.js';

initSentry();

const app = buildApp();
const port = Number(process.env.PORT ?? 3000);

// Belt and suspenders: anything outside a request's lifecycle (a Prisma pool error, a stray
// rejected promise) never reaches Fastify's own error handling, so it needs its own net —
// logged and reported the same way a request-scoped error is, instead of vanishing silently.
process.on('unhandledRejection', (reason) => {
  app.log.error({ err: reason }, 'unhandled rejection');
  captureException(reason);
});
process.on('uncaughtException', (err) => {
  app.log.error({ err }, 'uncaught exception');
  captureException(err);
});

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`listening on :${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    captureException(err);
    process.exit(1);
  });
