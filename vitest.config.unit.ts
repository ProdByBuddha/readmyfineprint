import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    dir: 'tests/unit',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage/unit'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared')
    }
  }
});
