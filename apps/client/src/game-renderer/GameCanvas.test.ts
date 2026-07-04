import type { MatchSnapshot, ServerEvent } from "@graphwar/shared";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameCanvas, shotEventKey } from "./GameCanvas";

const snapshot: MatchSnapshot = {
  phase: "playing",
  mode: "team-versus",
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
    const shotResolved: ServerEvent = {
      type: "shot-resolved",
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal",
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

    const html = renderToStaticMarkup(React.createElement(GameCanvas, { events: [shotResolved], snapshot }));

    expect(html).toContain("Battlefield");
    expect(html).toContain('data-rendered="true"');
    expect(html).toContain('data-path-points="2"');
  });

  it("treats identical shot payloads from different turns as distinct animations", () => {
    const baseShot = {
      type: "shot-resolved" as const,
      roomId: "local-test",
      shooterId: "alice",
      functionFamilyId: "normal" as const,
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
