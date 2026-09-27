import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: process.env.VITEST_CACHE_DIR ?? 'node_modules/.vite',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
