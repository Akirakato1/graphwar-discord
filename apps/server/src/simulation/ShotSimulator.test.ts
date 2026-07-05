import { describe, expect, it } from "vitest";
import { fieldBounds, type PlayerState, type TerrainState, type WorldPoint } from "@graphwar/shared";
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

function lastPathPoint(path: WorldPoint[]): WorldPoint | undefined {
  return path[path.length - 1];
}

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

  it("rotates shooter-local functions toward the selected aim direction", () => {
    const bobShooter: PlayerState = {
      id: "bob",
      displayName: "Bob",
      teamId: "team-b",
      position: { x: 10, y: 0 },
      hp: 100,
      alive: true
    };
    const players: PlayerState[] = [
      { id: "alice", displayName: "Alice", teamId: "team-a", position: { x: 7, y: 0 }, hp: 100, alive: true },
      bobShooter
    ];
    const result = new ShotSimulator().simulate({
      shooter: bobShooter,
      players,
      terrain: { blobs: [] },
      shot: NormalFunction.parse("0"),
      aimDirection: "west"
    });

    expect(result.impact.reason).toBe("player-hit");
    expect(result.impact.targetPlayerId).toBe("alice");
    expect(result.damage).toEqual([{ playerId: "alice", amount: 35, hpAfter: 65 }]);
  });

  it("truncates player-hit paths through the impact point", () => {
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
    expect(lastPathPoint(result.path)).toEqual(result.impact.point);
    expect(lastPathPoint(result.path)?.x).toBeLessThan(fieldBounds.maxX);
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

  it("truncates terrain-hit paths through the terrain impact point", () => {
    const terrain: TerrainState = {
      blobs: [{ id: "wall", outer: [{ x: 1, y: -1 }, { x: 2, y: -1 }, { x: 2, y: 1 }, { x: 1, y: 1 }], holes: [] }]
    };
    const result = new ShotSimulator().simulate({
      shooter,
      players: [shooter],
      terrain,
      shot: NormalFunction.parse("0")
    });

    expect(result.impact.reason).toBe("terrain-hit");
    expect(lastPathPoint(result.path)).toEqual(result.impact.point);
    expect(lastPathPoint(result.path)?.x).toBeLessThan(fieldBounds.maxX);
  });

  it("resolves a player before terrain as a player hit", () => {
    const terrain: TerrainState = {
      blobs: [{ id: "wall", outer: [{ x: 2, y: -1 }, { x: 3, y: -1 }, { x: 3, y: 1 }, { x: 2, y: 1 }], holes: [] }]
    };
    const players: PlayerState[] = [
      shooter,
      { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 1, y: 0 }, hp: 100, alive: true }
    ];
    const result = new ShotSimulator().simulate({ shooter, players, terrain, shot: NormalFunction.parse("0") });

    expect(result.impact.reason).toBe("player-hit");
    expect(result.impact.targetPlayerId).toBe("bob");
    expect(result.damage).toEqual([{ playerId: "bob", amount: 35, hpAfter: 65 }]);
    expect(result.terrain).toBe(terrain);
    expect(lastPathPoint(result.path)).toEqual(result.impact.point);
  });

  it("stops at the first field-boundary exit before a later re-entry player hit", () => {
    const players: PlayerState[] = [
      shooter,
      { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 1, y: 0 }, hp: 100, alive: true }
    ];
    const result = new ShotSimulator().simulate({
      shooter,
      players,
      terrain: { blobs: [] },
      shot: NormalFunction.parse("100 * sin(PI * x)")
    });

    expect(result.impact.reason).toBe("field-boundary");
    expect(result.impact.targetPlayerId).toBeUndefined();
    expect(result.damage).toEqual([]);
    expect(result.impact.point?.x).toBeGreaterThanOrEqual(fieldBounds.minX);
    expect(result.impact.point?.x).toBeLessThanOrEqual(fieldBounds.maxX);
    expect(result.impact.point?.y).toBeCloseTo(fieldBounds.maxY);
    expect(lastPathPoint(result.path)).toEqual(result.impact.point);
  });

  it("detects swept player collisions when sampled endpoints miss the hit radius", () => {
    const players: PlayerState[] = [
      shooter,
      { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 0.025, y: 0.5 }, hp: 100, alive: true }
    ];
    const result = new ShotSimulator().simulate({
      shooter,
      players,
      terrain: { blobs: [] },
      shot: NormalFunction.parse("20 * x")
    });

    expect(result.impact.reason).toBe("player-hit");
    expect(result.impact.targetPlayerId).toBe("bob");
    expect(result.impact.point?.x).toBeGreaterThan(0);
    expect(result.impact.point?.x).toBeLessThan(0.05);
    expect(lastPathPoint(result.path)).toEqual(result.impact.point);
  });

  it("detects swept terrain collisions through a thin wall when sampled endpoints are outside", () => {
    const terrain: TerrainState = {
      blobs: [
        {
          id: "thin-wall",
          outer: [
            { x: 0.02, y: 0.4 },
            { x: 0.03, y: 0.4 },
            { x: 0.03, y: 0.6 },
            { x: 0.02, y: 0.6 }
          ],
          holes: []
        }
      ]
    };
    const result = new ShotSimulator().simulate({
      shooter,
      players: [shooter],
      terrain,
      shot: NormalFunction.parse("20 * x")
    });

    expect(result.impact.reason).toBe("terrain-hit");
    expect(result.impact.point?.x).toBeGreaterThan(0);
    expect(result.impact.point?.x).toBeLessThan(0.05);
    expect(lastPathPoint(result.path)).toEqual(result.impact.point);
    expect(result.terrain.blobs).not.toEqual(terrain.blobs);
  });

  it("resolves terrain before a later undefined function impact", () => {
    const terrain: TerrainState = {
      blobs: [
        {
          id: "wall",
          outer: [
            { x: 0.45, y: -0.4 },
            { x: 0.55, y: -0.4 },
            { x: 0.55, y: -0.2 },
            { x: 0.45, y: -0.2 }
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

    expect(result.impact.reason).toBe("terrain-hit");
    expect(result.damage).toEqual([]);
    expect(result.impact.point?.x).toBeLessThan(1);
    expect(lastPathPoint(result.path)).toEqual(result.impact.point);
  });

  it("resolves player damage before a later undefined function impact", () => {
    const players: PlayerState[] = [
      shooter,
      { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 0.5, y: -0.3 }, hp: 100, alive: true }
    ];
    const result = new ShotSimulator().simulate({
      shooter,
      players,
      terrain: { blobs: [] },
      shot: NormalFunction.parse("sqrt(1 - x)")
    });

    expect(result.impact.reason).toBe("player-hit");
    expect(result.impact.targetPlayerId).toBe("bob");
    expect(result.damage).toEqual([{ playerId: "bob", amount: 35, hpAfter: 65 }]);
    expect(result.impact.point?.x).toBeLessThan(1);
    expect(lastPathPoint(result.path)).toEqual(result.impact.point);
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
            { x: 1.5, y: -1.5 },
            { x: 2, y: -1.5 },
            { x: 2, y: -0.5 },
            { x: 1.5, y: -0.5 }
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
