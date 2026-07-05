import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("map maker Vite config", () => {
  it("uses relative asset URLs so Electron file loading can find the renderer bundle", () => {
    const config = readFileSync(resolve(process.cwd(), "apps/map-maker/vite.config.ts"), "utf8");

    expect(config).toContain('base: "./"');
  });
});
