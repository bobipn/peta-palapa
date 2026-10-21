import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Files share one database when TEST_DATABASE_URL points at a real Postgres.
    fileParallelism: false,
  },
});
