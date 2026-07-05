import { describe, expect, it } from "vitest";
import { aliasesConflict, normalizeAlias } from "./alias";

describe("lobby alias helpers", () => {
  it("trims aliases and compares them case-insensitively", () => {
    expect(normalizeAlias("  Alice  ")).toBe("alice");
    expect(aliasesConflict(" ALICE ", "alice")).toBe(true);
    expect(aliasesConflict("Alice", "Bob")).toBe(false);
  });

  it("treats whitespace-only aliases as empty", () => {
    expect(normalizeAlias("   ")).toBe("");
  });
});
