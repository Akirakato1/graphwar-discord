import { describe, expect, it } from "vitest";
import { localToWorld } from "./coordinates";

describe("localToWorld", () => {
  it("translates shooter-local points into world coordinates", () => {
    expect(localToWorld({ x: 3, y: -2 }, { x: -10, y: 4 })).toEqual({ x: -7, y: 2 });
  });
});
