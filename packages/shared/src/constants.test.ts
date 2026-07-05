import { describe, expect, it } from "vitest";
import { defaultMatchTuning } from "./constants";

describe("defaultMatchTuning", () => {
  it("caps normal shot travel at 50 world units before field clipping", () => {
    const travelLimit = defaultMatchTuning.sampleStep * (defaultMatchTuning.maxPathPoints - 1);

    expect(travelLimit).toBeCloseTo(50);
  });
});
