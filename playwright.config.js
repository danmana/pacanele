import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 90000, workers: 1,
  use: { baseURL: 'http://localhost:4173', channel: 'chrome', headless: true, screenshot: 'only-on-failure', viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'npm run dev', url: 'http://localhost:4173', reuseExistingServer: true },
});
