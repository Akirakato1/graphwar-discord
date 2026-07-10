import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MatchHud, soundCueForTurnTimer } from "./MatchHud";
import type { MatchSnapshot } from "@graphwar/shared";

const session = {
  guildId: "local-guild",
  discordUserId: "alice",
  playerId: "alice",
  defaultAlias: "Alice",
  displayName: "Alice",
  roomId: "local-test",
  source: "local" as const
};

const standardWorldBounds = { minX: -25, maxX: 25, minY: -15, maxY: 15 };

const playingSnapshot: MatchSnapshot = {
  phase: "playing",
  mode: "team-versus",
  worldBounds: standardWorldBounds,
  players: [
    { id: "alice", displayName: "Alice", teamId: "team-a", position: { x: 0, y: 0 }, hp: 100, alive: true },
    { id: "bob", displayName: "Bob", teamId: "team-b", position: { x: 10, y: 0 }, hp: 100, alive: true }
  ],
  teams: [
    { id: "team-a", playerIds: ["alice"] },
    { id: "team-b", playerIds: ["bob"] }
  ],
  terrain: { blobs: [] },
  turn: { activePlayerId: "alice", order: ["alice", "bob"], turnNumber: 1 }
};

describe("MatchHud", () => {
  it("shows the latest local error instead of a stale rejection when both are present", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchHud, {
        connectionStatus: "open",
        lastError: "Enter a function before submitting a shot.",
        lastRejection: { playerId: "alice", reason: "Player is not active" },
        onSubmitShot: () => {},
        session
      })
    );

    expect(html).toContain("Enter a function before submitting a shot.");
    expect(html).not.toContain("Player is not active");
  });

  it("renders the function input palette during active play", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchHud, {
        connectionStatus: "open",
        onSubmitShot: () => {},
        session,
        snapshot: playingSnapshot
      })
    );

    expect(html).toContain("Function Shot");
    expect(html).toContain("aria-label=\"Your hit points\"");
    expect(html).toContain("♥");
    expect(html).toContain(">100</strong>");
    expect(html).toContain("class=\"hud-topline\"");
    expect(html).toContain("aria-label=\"Aim west\"");
    expect(html).toContain("aria-label=\"Insert sine function\"");
    expect(html).toContain("aria-label=\"Forfeit match\"");
    expect(html).toContain(">FF</button>");
    expect(html).toContain(">Fire</button>");
    expect(html).not.toContain("status-grid");
    expect(html).not.toContain("<dt>Phase</dt>");
  });

  it("keeps the fire button disabled when the active player is disconnected", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchHud, {
        connectionStatus: "closed",
        onSubmitShot: () => {},
        session,
        snapshot: playingSnapshot
      })
    );

    expect(html).toMatch(/class="primary-action"[^>]*disabled=""[^>]*type="submit">Fire<\/button>/);
  });

  it("keeps function prep editable when it is not the local player's turn", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchHud, {
        connectionStatus: "open",
        onSubmitShot: () => {},
        session,
        snapshot: {
          ...playingSnapshot,
          turn: { ...playingSnapshot.turn, activePlayerId: "bob" }
        }
      })
    );

    expect(html).toContain("Bob&#x27;s Turn");
    expect(html).toContain("id=\"shot-expression\"");
    expect(html).not.toMatch(/id="shot-expression"[^>]*disabled=""/);
    expect(html).not.toMatch(/aria-label="Aim west"[^>]*disabled=""/);
    expect(html).not.toMatch(/aria-label="Insert sine function"[^>]*disabled=""/);
    expect(html).toMatch(/class="primary-action"[^>]*disabled=""[^>]*type="submit">Fire<\/button>/);
  });

  it("shows turn time remaining and disables fire after the deadline", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchHud, {
        connectionStatus: "open",
        nowMs: Date.parse("2026-07-05T00:00:31.000Z"),
        onSubmitShot: () => {},
        session,
        snapshot: {
          ...playingSnapshot,
          turn: {
            ...playingSnapshot.turn,
            startedAt: "2026-07-05T00:00:00.000Z",
            deadlineAt: "2026-07-05T00:00:30.000Z",
            durationSeconds: 30
          }
        }
      })
    );

    expect(html).toContain("0s");
    expect(html).toContain("class=\"turn-timer critical-turn-timer\"");
    expect(html).toContain("id=\"shot-expression\"");
    expect(html).not.toMatch(/id="shot-expression"[^>]*disabled=""/);
    expect(html).toMatch(/class="primary-action"[^>]*disabled=""[^>]*type="submit">Fire<\/button>/);
  });

  it("marks the timer critical for the final ten seconds", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchHud, {
        connectionStatus: "open",
        nowMs: Date.parse("2026-07-05T00:00:21.000Z"),
        onSubmitShot: () => {},
        session,
        snapshot: {
          ...playingSnapshot,
          turn: {
            ...playingSnapshot.turn,
            startedAt: "2026-07-05T00:00:00.000Z",
            deadlineAt: "2026-07-05T00:00:30.000Z",
            durationSeconds: 30
          }
        }
      })
    );

    expect(html).toContain("9s");
    expect(html).toContain("class=\"turn-timer critical-turn-timer\"");
  });

  it("maps local turn timer changes to warning and timeout sounds", () => {
    expect(soundCueForTurnTimer(undefined, 10, true)).toBe("timer.tick");
    expect(soundCueForTurnTimer(10, 9, true)).toBe("timer.tick");
    expect(soundCueForTurnTimer(1, 0, true)).toBe("timer.timeout");
    expect(soundCueForTurnTimer(9, 8, false)).toBeUndefined();
    expect(soundCueForTurnTimer(30, 29, true)).toBeUndefined();
    expect(soundCueForTurnTimer(9, 9, true)).toBeUndefined();
  });

  it("hides function controls for spectators", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchHud, {
        connectionStatus: "open",
        onSubmitShot: () => undefined,
        session: {
          guildId: "local-guild",
          discordUserId: "spectator-id",
          playerId: "spectator-id",
          defaultAlias: "Spec",
          displayName: "Spec",
          source: "local"
        },
        snapshot: playingSnapshot,
        spectator: true
      })
    );

    expect(html).toContain("Spectating");
    expect(html).not.toContain("Function Shot");
    expect(html).not.toContain("Fire");
  });
});
