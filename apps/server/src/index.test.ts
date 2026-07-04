import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isMainModule } from "./index";

describe("isMainModule", () => {
  it("matches file URLs for Windows-style paths with spaces", () => {
    const entryPath = resolve("C:/Users/zhuyl/OneDrive/Desktop/Graphwar Discord Activity/apps/server/src/index.ts");

    expect(isMainModule(pathToFileURL(entryPath).href, entryPath)).toBe(true);
  });

  it("does not match imported modules", () => {
    expect(isMainModule(pathToFileURL(resolve("apps/server/src/index.ts")).href, resolve("apps/server/src/test.ts"))).toBe(
      false
    );
  });
});
