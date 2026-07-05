import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MatchHud } from "./MatchHud";
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

const playingSnapshot: MatchSnapshot = {
  phase: "playing",
  mode: "team-versus",
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
    expect(html).toContain("100 HP");
    expect(html).toContain("aria-label=\"Aim west\"");
    expect(html).toContain("aria-label=\"Insert sine function\"");
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

    expect(html).toContain("class=\"primary-action\" disabled=\"\" type=\"submit\">Fire</button>");
  });

  it("disables function entry when it is not the local player's turn", () => {
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
    expect(html).toMatch(/aria-label="Aim west"[^>]*disabled=""/);
    expect(html).toMatch(/aria-label="Insert sine function"[^>]*disabled=""/);
    expect(html).toContain("class=\"primary-action\" disabled=\"\" type=\"submit\">Fire</button>");
  });
});
