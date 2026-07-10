import { describe, expect, it } from "vitest";
import { soundIdForReleasedButton } from "./buttonSounds";

describe("soundIdForReleasedButton", () => {
  it("uses explicit button sound ids and falls back to a generic UI click", () => {
    expect(soundIdForReleasedButton({ disabled: false, soundId: "function.button" })).toBe("function.button");
    expect(soundIdForReleasedButton({ disabled: false })).toBe("ui.button");
  });

  it("does not emit sounds for disabled controls or unknown sound ids", () => {
    expect(soundIdForReleasedButton({ disabled: true, soundId: "function.button" })).toBeUndefined();
    expect(soundIdForReleasedButton({ disabled: false, soundId: "not-real" })).toBe("ui.button");
  });
});
