import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    exclude: ['node_modules', 'dist'],
  },
});
