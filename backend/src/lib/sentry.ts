import * as Sentry from '@sentry/node';

let initialized = false;

// Entirely optional — no-ops everywhere below when SENTRY_DSN isn't set, so nothing changes
// for anyone who hasn't set up a Sentry project. Call once at startup.
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function captureException(error: unknown) {
  if (!initialized) return;
  Sentry.captureException(error);
}
