import type { MatchEndedEvent, MatchSnapshot } from "@graphwar/shared";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatMatchWinner, MatchEndModal } from "./MatchEndModal";

const teamSnapshot: MatchSnapshot = {
  phase: "ended",
  mode: "team-versus",
  players: [
    { id: "alice", displayName: "Alice", teamId: "team-a", position: { x: 0, y: 0 }, hp: 65, alive: true },
    { id: "bob", displayName: "Bob", teamId: "team-a", position: { x: 1, y: 0 }, hp: 20, alive: true },
    { id: "cara", displayName: "Cara", teamId: "team-b", position: { x: 2, y: 0 }, hp: 0, alive: false }
  ],
  teams: [
    { id: "team-a", playerIds: ["alice", "bob"] },
    { id: "team-b", playerIds: ["cara"] }
  ],
  terrain: { blobs: [] },
  turn: { activePlayerId: "alice", order: ["alice", "bob", "cara"], turnNumber: 4 }
};

const freeForAllSnapshot: MatchSnapshot = {
  ...teamSnapshot,
  mode: "free-for-all",
  players: teamSnapshot.players.map((player) => ({ ...player, teamId: player.id })),
  teams: teamSnapshot.players.map((player) => ({ id: player.id, playerIds: [player.id] }))
};

describe("MatchEndModal", () => {
  it("formats team winners with team label and winner names", () => {
    expect(formatMatchWinner(teamSnapshot, ["alice", "bob"])).toEqual({
      title: "Team A wins",
      detail: "Alice, Bob"
    });
  });

  it("formats one free-for-all winner by name", () => {
    expect(formatMatchWinner(freeForAllSnapshot, ["alice"])).toEqual({
      title: "Alice wins",
      detail: "Alice"
    });
  });

  it("formats multiple free-for-all winners as winners", () => {
    expect(formatMatchWinner(freeForAllSnapshot, ["alice", "bob"])).toEqual({
      title: "Winners",
      detail: "Alice, Bob"
    });
  });

  it("formats no winners as a match-ended result", () => {
    expect(formatMatchWinner(freeForAllSnapshot, [])).toEqual({
      title: "Match ended",
      detail: "No winner"
    });
  });

  it("renders a blocking dialog with only the return action", () => {
    const event: MatchEndedEvent = {
      type: "match-ended",
      roomId: "room-1",
      winnerIds: ["alice", "bob"],
      snapshot: teamSnapshot
    };

    const html = renderToStaticMarkup(React.createElement(MatchEndModal, { event, onReturnToMenu: () => {} }));

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Team A wins");
    expect(html).toContain("Alice, Bob");
    expect(html).toContain("Return to Menu");
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it("renders long winner names and marks the return action for initial focus", () => {
    const longAlias = "AliceWithAnExceptionallyLongAliasThatNeedsWrappingInsideTheWinnerDialog";
    const snapshot: MatchSnapshot = {
      ...freeForAllSnapshot,
      players: [
        {
          ...freeForAllSnapshot.players[0],
          displayName: longAlias
        }
      ],
      teams: [{ id: "alice", playerIds: ["alice"] }]
    };
    const event: MatchEndedEvent = {
      type: "match-ended",
      roomId: "room-1",
      winnerIds: ["alice"],
      snapshot
    };

    const html = renderToStaticMarkup(React.createElement(MatchEndModal, { event, onReturnToMenu: () => {} }));

    expect(html).toContain(longAlias);
    expect(html).toMatch(/<button[^>]*autofocus/);
  });
});
