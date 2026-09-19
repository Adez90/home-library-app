import { defineConfig, devices } from '@playwright/test';

const FRONTEND_PORT = 5174;
const BACKEND_PORT = 3002;
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://library:library@localhost:5432/library_e2e';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false, // tests share one backend + database
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } }
      : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run backend:dev',
      url: `http://localhost:${BACKEND_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: String(BACKEND_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        JWT_SECRET: 'e2e-test-secret',
        NODE_ENV: 'test',
      },
    },
    {
      command: `npm run dev --workspace web -- --port ${FRONTEND_PORT}`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_API_PROXY_TARGET: `http://localhost:${BACKEND_PORT}`,
      },
    },
  ],
});
