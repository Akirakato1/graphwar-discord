import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import type { ClientCommand } from "./commands";
import type { ServerEvent } from "./events";
import { clientCommandSchema, serverEventSchema } from "./schemas";

describe("protocol schemas", () => {
  it("keeps client command schema output aligned with ClientCommand", () => {
    expectTypeOf<z.infer<typeof clientCommandSchema>>().toEqualTypeOf<ClientCommand>();
  });

  it("keeps server event schema output aligned with ServerEvent", () => {
    expectTypeOf<z.infer<typeof serverEventSchema>>().toEqualTypeOf<ServerEvent>();
  });

  it("accepts a valid submit-shot command", () => {
    const parsed = clientCommandSchema.parse({
      type: "submit-shot",
      roomId: "local-test",
      playerId: "alice",
      functionFamilyId: "normal",
      aimDirection: "west",
      expression: "sin(x)"
    });

    expect(parsed.type).toBe("submit-shot");
    expect(parsed).toMatchObject({ aimDirection: "west" });
  });

  it("rejects a submit-shot command without expression", () => {
    expect(() =>
      clientCommandSchema.parse({
        type: "submit-shot",
        roomId: "local-test",
        playerId: "alice",
        functionFamilyId: "normal",
        aimDirection: "west"
      })
    ).toThrow();
  });

  it("rejects a submit-shot command without aim direction", () => {
    expect(() =>
      clientCommandSchema.parse({
        type: "submit-shot",
        roomId: "local-test",
        playerId: "alice",
        functionFamilyId: "normal",
        expression: "sin(x)"
      })
    ).toThrow();
  });

  it("accepts a shot-resolved event with a path and snapshot", () => {
    const parsed = serverEventSchema.parse({
      type: "shot-resolved",
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal",
      aimDirection: "west",
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
    expect(parsed).toMatchObject({ aimDirection: "west" });
  });

  it("rejects a shot-resolved event without aim direction", () => {
    expect(() =>
      serverEventSchema.parse({
        type: "shot-resolved",
        roomId: "local-test",
        shooterId: "alice",
        functionFamilyId: "normal",
        expression: "x",
        path: [{ x: 0, y: 0 }],
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
      })
    ).toThrow();
  });

  it("rejects non-finite point data", () => {
    expect(() =>
      serverEventSchema.parse({
        type: "shot-resolved",
        roomId: "local-test",
        shooterId: "alice",
        functionFamilyId: "normal",
        aimDirection: "east",
        expression: "x",
        path: [{ x: Number.POSITIVE_INFINITY, y: 0 }],
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
      })
    ).toThrow();
  });

  it("rejects invalid impact reasons", () => {
    expect(() =>
      serverEventSchema.parse({
        type: "shot-resolved",
        roomId: "local-test",
        shooterId: "alice",
        functionFamilyId: "normal",
        aimDirection: "east",
        expression: "x",
        path: [{ x: 0, y: 0 }],
        impact: { reason: "near-miss" },
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
      })
    ).toThrow();
  });

  it("rejects invalid function family ids", () => {
    expect(() =>
      clientCommandSchema.parse({
        type: "submit-shot",
        roomId: "local-test",
        playerId: "alice",
        functionFamilyId: "parametric",
        aimDirection: "west",
        expression: "sin(x)"
      })
    ).toThrow();
  });
});
