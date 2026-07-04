import { describe, expect, it } from "vitest";
import { clientCommandSchema, serverEventSchema } from "./schemas";

describe("protocol schemas", () => {
  it("accepts a valid submit-shot command", () => {
    const parsed = clientCommandSchema.parse({
      type: "submit-shot",
      roomId: "local-test",
      playerId: "alice",
      functionFamilyId: "normal",
      expression: "sin(x)"
    });

    expect(parsed.type).toBe("submit-shot");
  });

  it("rejects a submit-shot command without expression", () => {
    expect(() =>
      clientCommandSchema.parse({
        type: "submit-shot",
        roomId: "local-test",
        playerId: "alice",
        functionFamilyId: "normal"
      })
    ).toThrow();
  });

  it("accepts a shot-resolved event with a path and snapshot", () => {
    const parsed = serverEventSchema.parse({
      type: "shot-resolved",
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal",
      expression: "x",
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ],
      impact: { reason: "miss" },
      damage: [],
      eliminations: [],
      snapshot: {
        phase: "playing",
        mode: "team-versus",
        players: [],
        teams: [],
        terrain: { blobs: [] },
        turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
      }
    });

    expect(parsed.type).toBe("shot-resolved");
  });
});
