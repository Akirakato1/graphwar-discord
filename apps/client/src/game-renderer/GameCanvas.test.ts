import type { MatchSnapshot, ServerEvent } from "@graphwar/shared";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameCanvas, canRetryAvatarUrl, resolveShotPlaybackState, shotEventKey } from "./GameCanvas";

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
      position: { x: 0, y: 0 },
      hp: 100,
      alive: true
    }
  ],
  teams: [{ id: "red", playerIds: ["alice"] }],
  terrain: { blobs: [] },
  turn: { activePlayerId: "alice", order: ["alice"], turnNumber: 1 }
};

describe("GameCanvas", () => {
  it("renders a canvas with current snapshot and latest shot metadata", () => {
    const snapshotWithTerrain: MatchSnapshot = {
      ...snapshot,
      terrain: {
        blobs: [
          {
            id: "test-platform",
            outer: [
              { x: -1, y: -1 },
              { x: 1, y: -1 },
              { x: 1, y: 1 },
              { x: -1, y: 1 }
            ],
            holes: []
          }
        ]
      }
    };
    const shotResolved: ServerEvent = {
      type: "shot-resolved",
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal",
      aimDirection: "east",
      expression: "x",
      path: [
        { x: 0, y: 0 },
        { x: 3, y: 2 }
      ],
      impact: { reason: "miss" },
      damage: [],
      eliminations: [],
      snapshot: snapshotWithTerrain
    };

    const html = renderToStaticMarkup(
      React.createElement(GameCanvas, { events: [shotResolved], snapshot: snapshotWithTerrain })
    );

    expect(html).toContain("Battlefield");
    expect(html).toContain('data-rendered="true"');
    expect(html).toContain('data-path-points="2"');
    expect(html).toContain('data-terrain-ids="test-platform"');
  });

  it("includes camera metadata when a snapshot is available", () => {
    const hugeSnapshot: MatchSnapshot = {
      ...snapshot,
      worldBounds: { minX: -50, maxX: 50, minY: -30, maxY: 30 }
    };

    const html = renderToStaticMarkup(React.createElement(GameCanvas, { events: [], snapshot: hugeSnapshot }));

    expect(html).toContain('data-camera-enabled="true"');
    expect(html).toContain('data-world-bounds="-50,50,-30,30"');
  });

  it("keeps latest shot metadata after an immediate turn event", () => {
    const shotResolved: ServerEvent = {
      type: "shot-resolved",
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal",
      aimDirection: "east",
      expression: "x",
      path: [
        { x: 0, y: 0 },
        { x: 3, y: 2 }
      ],
      impact: { reason: "miss" },
      damage: [],
      eliminations: [],
      snapshot
    };
    const html = renderToStaticMarkup(
      React.createElement(GameCanvas, {
        events: [shotResolved, { type: "turn-advanced", roomId: "local-test", playerId: "alice", turnNumber: 2 }],
        snapshot
      })
    );

    expect(html).toContain('data-path-points="2"');
  });

  it("treats identical shot payloads from different turns as distinct animations", () => {
    const baseShot = {
      type: "shot-resolved" as const,
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal" as const,
      aimDirection: "east" as const,
      expression: "x",
      path: [
        { x: 0, y: 0 },
        { x: 3, y: 2 }
      ],
      impact: { reason: "miss" as const },
      damage: [],
      eliminations: [],
      snapshot
    };

    expect(shotEventKey(baseShot)).not.toBe(
      shotEventKey({
        ...baseShot,
        snapshot: {
          ...snapshot,
          turn: { ...snapshot.turn, turnNumber: snapshot.turn.turnNumber + 1 }
        }
      })
    );
  });
});

describe("resolveShotPlaybackState", () => {
  it("preserves elapsed playback for the same shot key across non-shot rerenders", () => {
    expect(
      resolveShotPlaybackState(
        {
          activeShotKey: "shot-1",
          startedAt: 1_000,
          completedShotKey: undefined
        },
        "shot-1",
        1_300,
        750
      )
    ).toEqual({
      activeShotKey: "shot-1",
      startedAt: 1_000,
      completedShotKey: undefined,
      progress: 0.4
    });
  });

  it("resets playback timing only when a new shot key arrives", () => {
    expect(
      resolveShotPlaybackState(
        {
          activeShotKey: "shot-1",
          startedAt: 1_000,
          completedShotKey: "shot-1"
        },
        "shot-2",
        1_300,
        750
      )
    ).toEqual({
      activeShotKey: "shot-2",
      startedAt: 1_300,
      completedShotKey: undefined,
      progress: 0
    });
  });
});

describe("canRetryAvatarUrl", () => {
  it("allows a bounded number of retries for a static snapshot avatar url", () => {
    expect(canRetryAvatarUrl(undefined)).toBe(true);
    expect(canRetryAvatarUrl(1)).toBe(true);
    expect(canRetryAvatarUrl(2)).toBe(false);
  });
});
