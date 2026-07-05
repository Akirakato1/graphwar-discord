import type { MatchSnapshot, ServerEvent } from "@graphwar/shared";
import { describe, expect, it } from "vitest";
import { findLatestShotResolvedEvent, renderWorld, worldToCanvas } from "./renderWorld";

const snapshot: MatchSnapshot = {
  phase: "playing",
  mode: "team-versus",
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

  it("clears the visible shot once a newer turn event starts", () => {
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
    ).toBeUndefined();
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

  it("attenuates shot path color as the path consumes its length budget", () => {
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
    expect(pathStrokeAlphas[0]).toBeGreaterThan(pathStrokeAlphas[pathStrokeAlphas.length - 1]);
  });
});
