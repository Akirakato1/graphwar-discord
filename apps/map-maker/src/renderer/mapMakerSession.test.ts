import { describe, expect, it } from "vitest";
import { createReturnToMainMenuReset } from "./mapMakerSession";

describe("mapMakerSession", () => {
  it("resets editor-only state when returning to the main menu", () => {
    expect(createReturnToMainMenuReset()).toEqual({
      cameraBounds: null,
      clipboard: null,
      currentFile: null,
      drag: null,
      message: "Ready",
      state: null,
      tool: "select"
    });
  });
});
