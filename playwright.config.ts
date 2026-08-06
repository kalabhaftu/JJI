import { defineConfig, devices } from '@playwright/test'

const authStorageState = process.env.PLAYWRIGHT_AUTH_STORAGE_STATE

const browserProjects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
]

const authenticatedProjects = authStorageState
  ? browserProjects.map((project) => ({
      name: `${project.name}-auth`,
      testMatch: [
        '**/accessibility.e2e.test.ts',
        '**/keyboard-workflows.e2e.test.ts',
      ],
      use: { ...project.use, storageState: authStorageState },
    }))
  : []

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.{spec,test}.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [...browserProjects, ...authenticatedProjects],
  webServer: process.env.CI ? undefined : {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
