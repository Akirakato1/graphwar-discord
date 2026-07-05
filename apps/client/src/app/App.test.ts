import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App, GameSessionPill } from "./App";
import { LobbySetupView } from "../lobby/LobbySetupView";

describe("App", () => {
  it("renders the main menu before any websocket game UI", () => {
    const html = renderToStaticMarkup(React.createElement(App));

    expect(html).toContain("Create Lobby");
    expect(html).toContain("Join Lobby");
    expect(html).toContain("Settings");
    expect(html).toContain("Leaderboard");
    expect(html).not.toContain("Battlefield");
    expect(html).not.toContain("Function Shot");
  });

  it("disables lobby setup start while the lobby cannot start", () => {
    const html = renderToStaticMarkup(
      React.createElement(LobbySetupView, {
        currentPlayerId: "alice",
        lobby: {
          guildId: "local-guild",
          roomId: "room-1",
          name: "Friday Graphwar",
          mode: "team-versus",
          status: "open",
          leaderDiscordUserId: "alice",
          occupants: [],
          canStart: false,
          startBlockedReason: "Need at least two players.",
          createdAt: "2026-07-05T00:00:00.000Z"
        },
        onAutoAssign: () => {},
        onBack: () => {},
        onMove: () => {},
        onStart: () => {}
      })
    );

    expect(html).toContain("Need at least two players.");
    expect(html).toContain("disabled");
  });

  it("renders selected lobby details during gameplay", () => {
    const html = renderToStaticMarkup(
      React.createElement(GameSessionPill, {
        selectedLobbySession: {
          guildId: "local-guild",
          roomId: "room-1",
          discordUserId: "alice",
          playerId: "alice-id",
          alias: "Alice",
          slot: "player"
        },
        session: {
          guildId: "local-guild",
          discordUserId: "alice",
          playerId: "alice",
          defaultAlias: "Stale Name",
          displayName: "Stale Name",
          roomId: "stale-room",
          source: "local"
        }
      })
    );

    expect(html).toContain("Alice");
    expect(html).toContain("room-1");
    expect(html).not.toContain("stale-room");
  });
});
