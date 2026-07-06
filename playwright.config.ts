import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "apps/client/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "node ../../node_modules/tsx/dist/cli.mjs watch src/index.ts",
      cwd: "apps/server",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: true
    },
    {
      command: "node ../../node_modules/vite/bin/vite.js --host 0.0.0.0",
      cwd: "apps/client",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true
    }
  ]
});
