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
  // Give slower CI and chart initialization more headroom.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  // Allow a single retry locally; keep CI behaviour unchanged.
  retries: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    colorScheme: 'dark',
    launchOptions: { args: chromiumArgs },
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Use dedicated E2E preview so build-time env (QA probe, API/WS) is consistent.
    command: 'npm run preview:e2e',
    url: process.env.E2E_BASE_URL ?? 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NODE_ENV: 'production',
      VITE_QA_PROBE: '1',
      VITE_DEFAULT_SYMBOL: 'AAPL',
      VITE_API_URL: process.env.VITE_API_URL ?? 'http://localhost:8001',
      VITE_WS_URL: process.env.VITE_WS_URL ?? 'ws://localhost:8001/ws',
      VITE_CALENDAR_ENABLED: process.env.VITE_CALENDAR_ENABLED ?? '1',
    },
  },
});
