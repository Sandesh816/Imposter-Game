const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/*.deployed.spec.cjs',
  fullyParallel: false, workers: 1, timeout: 60000,
  expect: { timeout: 10000 }, retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
