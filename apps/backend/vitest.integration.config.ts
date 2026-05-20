import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.e2e-spec.ts'],
    testTimeout: 30_000,
    setupFiles: ['./test/setup.ts'],
    sequence: { concurrent: false },
    fileParallelism: false,
    pool: 'forks',
    forks: { singleFork: true },
  },
});
