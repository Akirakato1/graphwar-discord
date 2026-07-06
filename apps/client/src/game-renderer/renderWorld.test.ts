import type { MatchSnapshot, ServerEvent } from "@graphwar/shared";
import { describe, expect, it } from "vitest";
import {
  findLatestShotResolvedEvent,
  findSnapshotBeforeLatestShot,
  isLatestShotFollowedByTurnEvent,
  renderWorld,
  worldToCanvas
} from "./renderWorld";

const standardWorldBounds = { minX: -25, maxX: 25, minY: -15, maxY: 15 };

const snapshot: MatchSnapshot = {
  phase: "playing",
  mode: "team-versus",
  worldBounds: standardWorldBounds,
  players: [
    {
      id: "alice",
      displayName: "Alice",
      teamId: "red",
      position: { x: -10, y: 0 },
      hp: 82,
      alive: true
    },
    {
      id: "bob",
      displayName: "Bob",
      teamId: "blue",
      position: { x: 10, y: 5 },
      hp: 0,
      alive: false
    }
  ],
  teams: [
    { id: "red", playerIds: ["alice"] },
    { id: "blue", playerIds: ["bob"] }
  ],
  terrain: {
    blobs: [
      {
        id: "hill",
        outer: [
          { x: -20, y: -10 },
          { x: 20, y: -10 },
          { x: 20, y: -5 },
          { x: -20, y: -5 }
        ],
        holes: [
          [
            { x: -2, y: -8 },
            { x: 2, y: -8 },
            { x: 2, y: -6 },
            { x: -2, y: -6 }
          ]
        ]
      }
    ]
  },
  turn: { activePlayerId: "alice", order: ["alice", "bob"], turnNumber: 2 }
};

class RecordingCanvasContext {
  public readonly calls: Array<{ name: string; args: unknown[] }> = [];

  public font = "";
  public globalAlpha = 1;
  public lineWidth = 1;
  public textAlign = "";
  public textBaseline = "";
  private currentFillStyle = "";
  private currentStrokeStyle = "";

  public get fillStyle() {
    return this.currentFillStyle;
  }

  public set fillStyle(value: string) {
    this.currentFillStyle = value;
    this.record("setFillStyle", [value]);
  }

  public get strokeStyle() {
    return this.currentStrokeStyle;
  }

  public set strokeStyle(value: string) {
    this.currentStrokeStyle = value;
    this.record("setStrokeStyle", [value]);
  }

  public arc(...args: unknown[]) {
    this.record("arc", args);
  }

  public beginPath() {
    this.record("beginPath", []);
  }

  public clearRect(...args: unknown[]) {
    this.record("clearRect", args);
  }

  public closePath() {
    this.record("closePath", []);
  }

  public fill(...args: unknown[]) {
    this.record("fill", args);
  }

  public fillRect(...args: unknown[]) {
    this.record("fillRect", args);
  }

  public fillText(...args: unknown[]) {
    this.record("fillText", args);
  }

  public lineTo(...args: unknown[]) {
    this.record("lineTo", args);
  }

  public moveTo(...args: unknown[]) {
    this.record("moveTo", args);
  }

  public restore() {
    this.record("restore", []);
  }

  public save() {
    this.record("save", []);
  }

  public setLineDash(...args: unknown[]) {
    this.record("setLineDash", args);
  }

  public stroke() {
    this.record("stroke", []);
  }

  private record(name: string, args: unknown[]) {
    this.calls.push({ name, args });
  }
}

describe("worldToCanvas", () => {
  it("maps the shared field bounds into canvas pixels with origin centered and y upward", () => {
    const size = { width: 1000, height: 600 };

    expect(worldToCanvas({ x: 0, y: 0 }, size)).toEqual({ x: 500, y: 300 });
    expect(worldToCanvas({ x: -25, y: 15 }, size)).toEqual({ x: 0, y: 0 });
    expect(worldToCanvas({ x: 25, y: -15 }, size)).toEqual({ x: 1000, y: 600 });
  });

  it("letterboxes wide canvases instead of stretching world geometry", () => {
    const size = { width: 1000, height: 300 };

    expect(worldToCanvas({ x: 0, y: 0 }, size)).toEqual({ x: 500, y: 150 });
    expect(worldToCanvas({ x: -25, y: 15 }, size)).toEqual({ x: 250, y: 0 });
    expect(worldToCanvas({ x: 25, y: -15 }, size)).toEqual({ x: 750, y: 300 });
  });
});

describe("findLatestShotResolvedEvent", () => {
  it("returns the newest authoritative shot event from the recent event buffer", () => {
    const olderShot: ServerEvent = {
      type: "shot-resolved",
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal",
      aimDirection: "east",
      expression: "x",
      path: [{ x: 0, y: 0 }],
      impact: { reason: "miss" },
      damage: [],
      eliminations: [],
      snapshot
    };
    const newerShot: ServerEvent = {
      ...olderShot,
      aimDirection: "north",
      expression: "sin(x)",
      path: [
        { x: 0, y: 0 },
        { x: 8, y: 3 }
      ],
      impact: { reason: "terrain-hit", point: { x: 8, y: 3 } }
    };

    expect(
      findLatestShotResolvedEvent([
        olderShot,
        { type: "turn-started", roomId: "local-test", playerId: "bob", turnNumber: 3 },
        newerShot
      ])
    ).toBe(newerShot);
  });

  it("keeps the newest shot selectable after an immediate turn advance", () => {
    const shot: ServerEvent = {
      type: "shot-resolved",
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal",
      aimDirection: "east",
      expression: "x",
      path: [
        { x: 0, y: 0 },
        { x: 8, y: 0 }
      ],
      impact: { reason: "miss" },
      damage: [],
      eliminations: [],
      snapshot
    };

    expect(
      findLatestShotResolvedEvent([
        shot,
        { type: "turn-advanced", roomId: "local-test", playerId: "bob", turnNumber: 3 }
      ])
    ).toBe(shot);
  });

  it("reports when the latest shot has already been followed by a turn event", () => {
    const shot: ServerEvent = {
      type: "shot-resolved",
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal",
      aimDirection: "east",
      expression: "x",
      path: [
        { x: 0, y: 0 },
        { x: 8, y: 0 }
      ],
      impact: { reason: "miss" },
      damage: [],
      eliminations: [],
      snapshot
    };

    expect(isLatestShotFollowedByTurnEvent([shot])).toBe(false);
    expect(
      isLatestShotFollowedByTurnEvent([
        shot,
        { type: "turn-advanced", roomId: "local-test", playerId: "bob", turnNumber: 3 }
      ])
    ).toBe(true);
    expect(
      isLatestShotFollowedByTurnEvent([
        { type: "turn-started", roomId: "local-test", playerId: "alice", turnNumber: 2 },
        shot
      ])
    ).toBe(false);
    expect(
      isLatestShotFollowedByTurnEvent([
        { type: "turn-started", roomId: "local-test", playerId: "alice", turnNumber: 2 }
      ])
    ).toBe(false);
  });

  it("returns the authoritative snapshot before the latest shot for playback staging", () => {
    const beforeShot: ServerEvent = {
      type: "room-snapshot",
      roomId: "local-test",
      snapshot: {
        ...snapshot,
        terrain: { blobs: [] },
        players: snapshot.players.map((player) => ({ ...player, hp: 100, alive: true }))
      }
    };
    const afterShot: ServerEvent = {
      type: "shot-resolved",
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal",
      aimDirection: "east",
      expression: "x",
      path: [
        { x: -10, y: 0 },
        { x: 10, y: 0 }
      ],
      impact: { reason: "player-hit", point: { x: 10, y: 0 }, targetPlayerId: "bob" },
      damage: [{ playerId: "bob", amount: 35, hpAfter: 65 }],
      eliminations: [],
      snapshot: {
        ...snapshot,
        players: snapshot.players.map((player) => (player.id === "bob" ? { ...player, hp: 65 } : player))
      }
    };

    expect(findSnapshotBeforeLatestShot([beforeShot, afterShot])).toBe(beforeShot.snapshot);
  });
});

describe("renderWorld", () => {
  it("draws the world layers, terrain holes, players, labels, shot path, and impact ring", () => {
    const context = new RecordingCanvasContext();

    renderWorld(context as unknown as CanvasRenderingContext2D, { width: 1000, height: 600 }, {
      snapshot,
      shot: {
        path: [
          { x: -10, y: 0 },
          { x: 0, y: 10 },
          { x: 10, y: 0 }
        ],
        impact: { reason: "terrain-hit", point: { x: 10, y: 0 } },
        progress: 1
      }
    });

    expect(context.calls[0]).toEqual({ name: "save", args: [] });
    expect(context.calls.some((call) => call.name === "fillRect" && call.args.join(",") === "0,0,1000,600")).toBe(
      true
    );
    expect(context.calls.some((call) => call.name === "fill" && call.args[0] === "evenodd")).toBe(true);
    expect(context.calls.some((call) => call.name === "fillText" && call.args[0] === "Alice")).toBe(true);
    expect(context.calls.some((call) => call.name === "fillText" && call.args[0] === "red")).toBe(true);
    expect(context.calls.some((call) => call.name === "fillText" && call.args[0] === "82 HP")).toBe(true);
    expect(context.calls.some((call) => call.name === "fillText" && call.args[0] === "Bob")).toBe(true);
    expect(context.calls.some((call) => call.name === "fillText" && call.args[0] === "Down")).toBe(true);
    expect(context.calls.some((call) => call.name === "lineTo" && call.args[0] === 700 && call.args[1] === 300)).toBe(
      true
    );
    expect(
      context.calls.some(
        (call) => call.name === "arc" && call.args[0] === 700 && call.args[1] === 300 && Number(call.args[2]) > 20
      )
    ).toBe(true);
    expect(context.calls.at(-1)).toEqual({ name: "restore", args: [] });
  });

  it("reveals only the requested fraction of a shot path", () => {
    const context = new RecordingCanvasContext();

    renderWorld(context as unknown as CanvasRenderingContext2D, { width: 1000, height: 600 }, {
      snapshot,
      shot: {
        path: [
          { x: -10, y: 0 },
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ],
        impact: { reason: "miss" },
        progress: 0.5
      }
    });

    expect(context.calls.some((call) => call.name === "lineTo" && call.args[0] === 500 && call.args[1] === 300)).toBe(
      true
    );
    expect(context.calls.some((call) => call.name === "lineTo" && call.args[0] === 700 && call.args[1] === 300)).toBe(
      false
    );
  });

  it("linearly attenuates shot path opacity over the returned path while keeping the tail visible", () => {
    const context = new RecordingCanvasContext();

    renderWorld(context as unknown as CanvasRenderingContext2D, { width: 1000, height: 600 }, {
      snapshot,
      shot: {
        path: [
          { x: -10, y: 0 },
          { x: -5, y: 0 },
          { x: 0, y: 0 },
          { x: 5, y: 0 }
        ],
        impact: { reason: "miss" },
        progress: 1
      }
    });

    const pathStrokeAlphas = context.calls
      .filter((call) => call.name === "setStrokeStyle")
      .map((call) => String(call.args[0]))
      .map((value) => value.match(/^rgba\(249, 242, 199, ([\d.]+)\)$/)?.[1])
      .filter((alpha): alpha is string => Boolean(alpha))
      .map(Number);

    expect(pathStrokeAlphas.length).toBeGreaterThan(1);
    expect(pathStrokeAlphas[0]).toBeCloseTo(0.95);
    expect(pathStrokeAlphas[1]).toBeCloseTo(0.575);
    expect(pathStrokeAlphas[2]).toBeCloseTo(0.2);
  });

  it("draws a small fizzle marker when a shot runs out of max function length", () => {
    const context = new RecordingCanvasContext();

    renderWorld(context as unknown as CanvasRenderingContext2D, { width: 1000, height: 600 }, {
      snapshot,
      shot: {
        path: [
          { x: -10, y: 0 },
          { x: 0, y: 0 }
        ],
        impact: { reason: "path-too-long", point: { x: 0, y: 0 } },
        progress: 1
      }
    });

    const centerArcs = context.calls.filter(
      (call) => call.name === "arc" && call.args[0] === 500 && call.args[1] === 300
    );
    const fillStyles = context.calls
      .filter((call) => call.name === "setFillStyle")
      .map((call) => String(call.args[0]));
    const strokeStyles = context.calls
      .filter((call) => call.name === "setStrokeStyle")
      .map((call) => String(call.args[0]));
    const fizzleStrokeIndex = context.calls.findIndex(
      (call) => call.name === "setStrokeStyle" && call.args[0] === "rgba(249, 242, 199, 0.72)"
    );
    const fizzleRestoreIndex = context.calls.findIndex(
      (call, index) => index > fizzleStrokeIndex && call.name === "restore"
    );
    const fizzleCalls = context.calls.slice(fizzleStrokeIndex, fizzleRestoreIndex);

    expect(centerArcs.some((call) => Number(call.args[2]) > 0 && Number(call.args[2]) < 20)).toBe(true);
    expect(centerArcs.some((call) => Number(call.args[2]) > 20)).toBe(false);
    expect(fillStyles).not.toContain("rgba(255, 111, 108, 0.16)");
    expect(strokeStyles).toContain("rgba(249, 242, 199, 0.72)");
    expect(fizzleCalls.some((call) => call.name === "lineTo")).toBe(false);
  });

  it("uses a player's chosen lobby color for their marker and name label", () => {
    const context = new RecordingCanvasContext();

    renderWorld(context as unknown as CanvasRenderingContext2D, { width: 1000, height: 600 }, {
      snapshot: {
        ...snapshot,
        players: [
          {
            ...snapshot.players[0],
            color: "#f72585"
          }
        ],
        teams: [{ id: "red", playerIds: ["alice"] }]
      }
    });

    const fillStyles = context.calls
      .filter((call) => call.name === "setFillStyle")
      .map((call) => String(call.args[0]));
    expect(fillStyles.filter((value) => value === "#f72585")).toHaveLength(2);
  });
});
