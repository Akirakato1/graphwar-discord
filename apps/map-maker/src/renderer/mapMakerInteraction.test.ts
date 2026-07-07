import { describe, expect, it } from "vitest";
import {
  placementToolFromPointer,
  shouldAssignTeamFromPointer,
  shouldDrawPenPointFromPointer,
  shouldSelectFromPointer
} from "./mapMakerInteraction";

describe("mapMakerInteraction", () => {
  it("uses primary clicks for selection instead of placement while a stamp tool is active", () => {
    expect(shouldSelectFromPointer({ button: 0, isSpaceDown: false })).toBe(true);
    expect(placementToolFromPointer("rectangle", 0)).toBeUndefined();
    expect(placementToolFromPointer("circle", 0)).toBeUndefined();
    expect(placementToolFromPointer("spawn", 0)).toBeUndefined();
  });

  it("uses secondary clicks to place stamp tools", () => {
    expect(placementToolFromPointer("rectangle", 2)).toBe("rectangle");
    expect(placementToolFromPointer("triangle", 2)).toBe("triangle");
    expect(placementToolFromPointer("circle", 2)).toBe("circle");
    expect(placementToolFromPointer("spawn", 2)).toBe("spawn");
  });

  it("keeps pen and team tools on explicit primary-click behaviors", () => {
    expect(placementToolFromPointer("pen", 2)).toBeUndefined();
    expect(shouldDrawPenPointFromPointer("pen", 0)).toBe(true);
    expect(shouldDrawPenPointFromPointer("rectangle", 0)).toBe(false);
    expect(shouldAssignTeamFromPointer("team-a", 0)).toBe(true);
    expect(shouldAssignTeamFromPointer("team-b", 0)).toBe(true);
    expect(shouldAssignTeamFromPointer("team-a", 2)).toBe(false);
  });
});
