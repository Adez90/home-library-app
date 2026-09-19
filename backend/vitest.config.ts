import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 15000,
    env: {
      NODE_ENV: 'test',
    },
    // Test files share one real Postgres database and clean it up between tests,
    // so different files must not run concurrently against it.
    fileParallelism: false,
  },
});
