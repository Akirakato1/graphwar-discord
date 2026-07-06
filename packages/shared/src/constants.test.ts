import { describe, expect, it } from "vitest";
import { defaultMatchTuning } from "./constants";

describe("defaultMatchTuning", () => {
  it("samples normal shots at half-size dx while preserving 50 world units of travel capacity", () => {
    const travelLimit = defaultMatchTuning.sampleStep * (defaultMatchTuning.maxPathPoints - 1);

    expect(defaultMatchTuning.sampleStep).toBeCloseTo(0.025);
    expect(travelLimit).toBeCloseTo(50);
  });
});
