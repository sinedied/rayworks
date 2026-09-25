import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '*.spec.ts',
  outputDir: './.test-results',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4178', browserName: 'chromium', channel: 'chrome' },
  webServer: {
    command: 'npx vite --config tests/browser/vite.config.ts --host 127.0.0.1 --port 4178 --strictPort',
    url: 'http://127.0.0.1:4178/tests/browser/index.html',
    reuseExistingServer: false,
  },
});
