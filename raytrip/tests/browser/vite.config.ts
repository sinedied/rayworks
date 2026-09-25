import { defineConfig, mergeConfig } from 'vite';
import { resolve } from 'node:path';
import base from '../../vite.config';
export default mergeConfig(base, defineConfig({
  resolve: { alias: [{ find: '@/services/trips', replacement: resolve(import.meta.dirname, 'trips.ts') }] },
}));
