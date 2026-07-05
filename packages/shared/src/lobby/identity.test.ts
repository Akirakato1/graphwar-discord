import { describe, expect, it } from "vitest";
import {
  defaultMaxFunctionLength,
  defaultPlayerColor,
  functionLengthBounds,
  normalizeMaxFunctionLength,
  playerColorPalette
} from "./identity";

describe("lobby identity settings", () => {
  it("provides ten unique fixed player colors with a valid default", () => {
    expect(playerColorPalette).toHaveLength(10);
    expect(new Set(playerColorPalette).size).toBe(10);
    expect(playerColorPalette).toContain(defaultPlayerColor);
  });

  it("normalizes finite max function length values for internal callers", () => {
    expect(functionLengthBounds).toEqual({ min: 20, max: 100, default: 50 });
    expect(defaultMaxFunctionLength).toBe(50);
    expect(normalizeMaxFunctionLength(undefined)).toBe(50);
    expect(normalizeMaxFunctionLength(10)).toBe(20);
    expect(normalizeMaxFunctionLength(42.7)).toBe(43);
    expect(normalizeMaxFunctionLength(150)).toBe(100);
  });
});
