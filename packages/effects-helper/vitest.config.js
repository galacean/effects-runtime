import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@galacean/effects-helper',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  test: {
    include: ['test/**/*.ts'],
    testTimeout: 30000,
    passWithNoTests: true,
  },
});
