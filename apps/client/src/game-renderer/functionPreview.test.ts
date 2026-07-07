import { describe, expect, it } from "vitest";
import type { MatchSnapshot } from "@graphwar/shared";
import { computeFunctionPreview } from "./functionPreview";

const snapshot: MatchSnapshot = {
  phase: "playing",
  mode: "team-versus",
  worldBounds: { minX: -25, maxX: 25, minY: -15, maxY: 15 },
  players: [
    { id: "alice", displayName: "Alice", teamId: "team-a", position: { x: 0, y: 0 }, hp: 100, alive: true }
  ],
  teams: [{ id: "team-a", playerIds: ["alice"] }],
  terrain: { blobs: [] },
  turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
};

describe("computeFunctionPreview", () => {
  it("samples a shooter-local preview through the full max length", () => {
    const path = computeFunctionPreview({
      aimDirection: "east",
      expression: "0",
      maxFunctionLength: 1,
      playerId: "alice",
      snapshot
    });

    expect(path?.length).toBeGreaterThan(2);
    expect(path?.[0]).toEqual({ x: 0, y: 0 });
    expect(path?.at(-1)?.x).toBeCloseTo(1);
    expect(path?.at(-1)?.y).toBeCloseTo(0);
  });

  it("rotates preview paths by the selected aim direction", () => {
    const path = computeFunctionPreview({
      aimDirection: "west",
      expression: "0",
      maxFunctionLength: 1,
      playerId: "alice",
      snapshot
    });

    expect(path?.at(-1)?.x).toBeCloseTo(-1);
    expect(path?.at(-1)?.y).toBeCloseTo(0);
  });

  it("hides invalid previews but allows advanced functions when enabled", () => {
    expect(
      computeFunctionPreview({
        aimDirection: "east",
        expression: "sqrt(-1)",
        maxFunctionLength: 1,
        playerId: "alice",
        snapshot
      })
    ).toBeUndefined();
    expect(
      computeFunctionPreview({
        advancedFunctions: false,
        aimDirection: "east",
        expression: "gamma(x + 1)",
        maxFunctionLength: 1,
        playerId: "alice",
        snapshot
      })
    ).toBeUndefined();
    expect(
      computeFunctionPreview({
        advancedFunctions: true,
        aimDirection: "east",
        expression: "gamma(x + 1)",
        maxFunctionLength: 1,
        playerId: "alice",
        snapshot
      })?.length
    ).toBeGreaterThan(2);
  });
});
