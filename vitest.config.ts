import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "apps/**/*.integration.test.ts"],
    environment: "node",
    passWithNoTests: true
  },
  resolve: {
    alias: {
      "@graphwar/shared": new URL("./packages/shared/src/index.ts", import.meta.url).pathname,
      "@graphwar/shared/": new URL("./packages/shared/src/", import.meta.url).pathname
    }
  }
});
