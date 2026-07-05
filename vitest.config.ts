import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
      "apps/**/*.integration.test.ts"
    ],
    environment: "node",
    passWithNoTests: true
  },
  resolve: {
    alias: {
      "@graphwar/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@graphwar/shared/": fileURLToPath(new URL("./packages/shared/src/", import.meta.url))
    }
  }
});
