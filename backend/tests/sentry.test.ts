import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/node', () => ({ init: vi.fn(), captureException: vi.fn() }));

describe('sentry helper', () => {
  const originalDsn = process.env.SENTRY_DSN;

  afterEach(() => {
    if (originalDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalDsn;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does nothing when SENTRY_DSN is not set', async () => {
    delete process.env.SENTRY_DSN;
    const Sentry = await import('@sentry/node');
    const { initSentry, captureException } = await import('../src/lib/sentry.js');

    initSentry();
    captureException(new Error('boom'));

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('initializes and forwards exceptions when SENTRY_DSN is set', async () => {
    process.env.SENTRY_DSN = 'https://example@o0.ingest.sentry.io/1';
    const Sentry = await import('@sentry/node');
    const { initSentry, captureException } = await import('../src/lib/sentry.js');

    initSentry();
    const error = new Error('boom');
    captureException(error);

    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: process.env.SENTRY_DSN }));
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
