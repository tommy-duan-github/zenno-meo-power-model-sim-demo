import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', webServer: { command: 'npm run start', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI }, use: { baseURL: 'http://localhost:4173', channel: 'chrome' } });
