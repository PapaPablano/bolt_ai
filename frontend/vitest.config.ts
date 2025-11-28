import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: false,
    watch: false,
    testTimeout: 10000,
    hookTimeout: 10000,
    reporters: process.env.CI ? ['verbose', 'github-actions'] : ['verbose'],
    bail: process.env.CI ? 1 : 0,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
      include: ['src/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
