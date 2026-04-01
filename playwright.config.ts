import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3210",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm start -p 3210",
    url: "http://127.0.0.1:3210/roadmap",
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
