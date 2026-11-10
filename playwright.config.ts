import { defineConfig, devices } from "@playwright/test";

const postgresUrl = process.env.E2E_DATABASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: postgresUrl
      ? "npm run build && npm run start"
      : "rm -rf .e2e && npm run build && npm run start",
    env: {
      PORT: "3100",
      ...(postgresUrl
        ? { DATABASE_URL: postgresUrl }
        : { DATABASE_PATH: ".e2e/soffice.db" }),
    },
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 240_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
