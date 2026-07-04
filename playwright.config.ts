import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "apps/client/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "npm --workspace apps/server run dev",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: true
    },
    {
      command: "npm --workspace apps/client run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true
    }
  ]
});
