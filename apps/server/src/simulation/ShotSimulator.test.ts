import { describe, expect, it } from "vitest";
import type { PlayerState, TerrainState } from "@graphwar/shared";
import { NormalFunction } from "../functions/NormalFunction";
import { ShotSimulator } from "./ShotSimulator";

const shooter: PlayerState = {
  id: "alice",
  displayName: "Alice",
  teamId: "team-a",
  position: { x: 0, y: 0 },
  hp: 100,
  alive: true
};

describe("ShotSimulator", () => {
  it("detects player hits in world space", () => {
    const players: PlayerState[] = [
      shooter,
      { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 3, y: 0 }, hp: 100, alive: true }
    ];
    const result = new ShotSimulator().simulate({
      shooter,
      players,
      terrain: { blobs: [] },
      shot: NormalFunction.parse("0")
    });

    expect(result.impact.reason).toBe("player-hit");
    expect(result.impact.targetPlayerId).toBe("bob");
    expect(result.damage).toEqual([{ playerId: "bob", amount: 35, hpAfter: 65 }]);
  });

  it("detects terrain hits before later player hits", () => {
    const terrain: TerrainState = {
      blobs: [{ id: "wall", outer: [{ x: 1, y: -1 }, { x: 2, y: -1 }, { x: 2, y: 1 }, { x: 1, y: 1 }], holes: [] }]
    };
    const players: PlayerState[] = [
      shooter,
      { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 3, y: 0 }, hp: 100, alive: true }
    ];
    const result = new ShotSimulator().simulate({ shooter, players, terrain, shot: NormalFunction.parse("0") });

    expect(result.impact.reason).toBe("terrain-hit");
    expect(result.damage).toEqual([]);
    expect(result.terrain.blobs).not.toEqual(terrain.blobs);
  });

  it("marks a direct-hit target eliminated when hp reaches zero", () => {
    const players: PlayerState[] = [
      shooter,
      { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 3, y: 0 }, hp: 20, alive: true }
    ];
    const result = new ShotSimulator().simulate({
      shooter,
      players,
      terrain: { blobs: [] },
      shot: NormalFunction.parse("0")
    });

    expect(result.damage).toEqual([{ playerId: "bob", amount: 35, hpAfter: 0 }]);
    expect(result.eliminations).toEqual(["bob"]);
    expect(result.players.find((player) => player.id === "bob")).toMatchObject({ hp: 0, alive: false });
  });

  it("craters terrain at the last finite point when a later sample is undefined", () => {
    const terrain: TerrainState = {
      blobs: [
        {
          id: "ledge",
          outer: [
            { x: 0.5, y: -1.5 },
            { x: 1.5, y: -1.5 },
            { x: 1.5, y: -0.5 },
            { x: 0.5, y: -0.5 }
          ],
          holes: []
        }
      ]
    };
    const result = new ShotSimulator().simulate({
      shooter,
      players: [shooter],
      terrain,
      shot: NormalFunction.parse("sqrt(1 - x)")
    });

    expect(result.impact).toEqual({ reason: "undefined-function", point: { x: 1, y: -1 } });
    expect(result.damage).toEqual([]);
    expect(result.terrain.blobs).not.toEqual(terrain.blobs);
  });

  it("leaves players and terrain unchanged when the shot misses", () => {
    const terrain: TerrainState = { blobs: [] };
    const players: PlayerState[] = [
      shooter,
      { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 3, y: 2 }, hp: 100, alive: true }
    ];
    const result = new ShotSimulator().simulate({
      shooter,
      players,
      terrain,
      shot: NormalFunction.parse("0")
    });

    expect(result.impact.reason).toBe("miss");
    expect(result.damage).toEqual([]);
    expect(result.eliminations).toEqual([]);
    expect(result.players).toBe(players);
    expect(result.terrain).toBe(terrain);
  });
});
