import { defineConfig, devices } from '@playwright/test';

const chromiumArgs = [
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion',
  '--mute-audio',
];

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    colorScheme: 'dark',
    launchOptions: { args: chromiumArgs },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bash -lc "VITE_QA_PROBE=1 npm run build && npm run preview -- --host --port 5174"',
    url: process.env.E2E_BASE_URL ?? 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NODE_ENV: 'production',
      VITE_QA_PROBE: '1',
      VITE_DEFAULT_SYMBOL: 'AAPL',
      VITE_API_URL: process.env.VITE_API_URL ?? 'http://localhost:8000',
      VITE_WS_URL: process.env.VITE_WS_URL ?? 'ws://localhost:8000/ws',
      VITE_CALENDAR_ENABLED: process.env.VITE_CALENDAR_ENABLED ?? '1',
    },
  },
});
