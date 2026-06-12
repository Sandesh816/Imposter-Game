const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'https://imposter-sandeshg.web.app';
const chromiumUse = { ...devices['Desktop Chrome'] };

if (process.env.PLAYWRIGHT_CHROMIUM_CHANNEL) {
  chromiumUse.channel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL;
}

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 240000,
  expect: {
    timeout: 30000,
  },
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: 'chromium',
      use: chromiumUse,
    },
  ],
});
