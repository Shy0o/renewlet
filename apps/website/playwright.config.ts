import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  projects: [
    {
      name: 'local-desktop',
      use: {
        baseURL: 'http://127.0.0.1:4173',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'local-mobile',
      use: {
        baseURL: 'http://127.0.0.1:4173',
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
