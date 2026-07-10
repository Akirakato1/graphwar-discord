import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MatchSnapshot, ServerEvent, ShotResolvedEvent } from "@graphwar/shared";
import { ShotHistoryTab, shotHistoryEntriesFromEvents } from "./ShotHistoryTab";

const snapshot: MatchSnapshot = {
  phase: "playing",
  mode: "team-versus",
  worldBounds: { minX: -25, maxX: 25, minY: -15, maxY: 15 },
  players: [
    {
      id: "alice",
      displayName: "Alice",
      avatarUrl: "https://cdn.example/alice.png",
      color: "#4cc9f0",
      teamId: "team-a",
      position: { x: 0, y: 0 },
      hp: 100,
      alive: true
    },
    {
      id: "bob",
      displayName: "Bob",
      color: "#f72585",
      teamId: "team-b",
      position: { x: 10, y: 0 },
      hp: 65,
      alive: true
    }
  ],
  teams: [
    { id: "team-a", playerIds: ["alice"] },
    { id: "team-b", playerIds: ["bob"] }
  ],
  terrain: { blobs: [] },
  turn: { activePlayerId: "alice", order: ["alice", "bob"], turnNumber: 3 }
};

function shotEvent(
  shooterId: string,
  expression: string,
  reason: ShotResolvedEvent["impact"]["reason"],
  turnNumber: number
): ShotResolvedEvent {
  return {
    type: "shot-resolved",
    roomId: "room-1",
    shooterId,
    functionFamilyId: "normal",
    aimDirection: "west",
    expression,
    path: [
      { x: 0, y: 0 },
      { x: -1, y: 0 }
    ],
    impact: { reason },
    terrain: { blobs: [] },
    damage: [],
    eliminations: [],
    snapshot: {
      ...snapshot,
      turn: { ...snapshot.turn, turnNumber }
    }
  };
}

describe("ShotHistoryTab", () => {
  it("derives newest-first function history entries with shooter profile metadata", () => {
    const entries = shotHistoryEntriesFromEvents([
      { type: "turn-started", roomId: "room-1", playerId: "alice", turnNumber: 1 },
      shotEvent("alice", "sin(x)", "terrain-hit", 1),
      shotEvent("bob", "cos(x)", "player-hit", 2)
    ] as ServerEvent[]);

    expect(entries.map((entry) => entry.expression)).toEqual(["cos(x)", "sin(x)"]);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        shooterName: "Bob",
        shooterColor: "#f72585",
        impactReason: "player-hit"
      })
    );
    expect(entries[1]).toEqual(
      expect.objectContaining({
        shooterName: "Alice",
        shooterAvatarUrl: "https://cdn.example/alice.png",
        shooterColor: "#4cc9f0"
      })
    );
  });

  it("renders nothing when disabled by lobby setting", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShotHistoryTab, {
        enabled: false,
        events: [shotEvent("alice", "sin(x)", "terrain-hit", 1)]
      })
    );

    expect(html).toBe("");
  });

  it("starts collapsed as a left-edge expand button", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShotHistoryTab, {
        enabled: true,
        events: [shotEvent("alice", "sin(x)", "terrain-hit", 1)]
      })
    );

    expect(html).toContain("shot-history-tab collapsed");
    expect(html).toContain("aria-label=\"Expand function history\"");
    expect(html).toContain("&gt;");
    expect(html).not.toContain("sin(x)");
  });

  it("renders expanded shot rows with profile icon, name, expression, and impact", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShotHistoryTab, {
        defaultExpanded: true,
        enabled: true,
        events: [shotEvent("alice", "sin(x)", "terrain-hit", 1), shotEvent("bob", "cos(x)", "player-hit", 2)]
      })
    );

    expect(html).toContain("shot-history-tab expanded");
    expect(html).toContain("Function history");
    expect(html).toContain("https://cdn.example/alice.png");
    expect(html).toContain("Alice");
    expect(html).toContain("Bob");
    expect(html).toContain("sin(x)");
    expect(html).toContain("cos(x)");
    expect(html).toContain("player hit");
  });
});
