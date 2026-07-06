import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultLobbyGameplaySettings, defaultPlayerColor } from "@graphwar/shared";
import { App, GameSessionPill, resolveLocalLobbyIdentity } from "./App";
import { LobbySetupView } from "../lobby/LobbySetupView";

describe("App", () => {
  const AppWithViewOverride = App as React.ComponentType<{ viewOverride?: "custom-maps" }>;

  it("renders the main menu before any websocket game UI", () => {
    const html = renderToStaticMarkup(React.createElement(App));

    expect(html).toContain("Create Lobby");
    expect(html).toContain("Join Lobby");
    expect(html).toContain("Settings");
    expect(html).toContain("Leaderboard");
    expect(html).toContain("Custom Maps");
    expect(html).not.toContain("Battlefield");
    expect(html).not.toContain("Function Shot");
  });

  it("routes the custom maps view without rendering gameplay HUD", () => {
    const html = renderToStaticMarkup(React.createElement(AppWithViewOverride, { viewOverride: "custom-maps" }));

    expect(html).toContain("Custom Maps");
    expect(html).toContain("Load Custom Map");
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
          maxFunctionLength: 50,
          ...defaultLobbyGameplaySettings,
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
          color: defaultPlayerColor,
          slot: "player",
          sessionToken: "session-token"
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

  it("uses the latest lobby occupant to resolve spectator state when selected session slot is stale", () => {
    const identity = resolveLocalLobbyIdentity({
      currentLobby: {
        guildId: "local-guild",
        roomId: "room-1",
        name: "Friday Graphwar",
        mode: "team-versus",
        status: "playing",
        leaderDiscordUserId: "alice-discord",
        occupants: [
          {
            discordUserId: "alice-discord",
            playerId: "alice-player",
            alias: "Alice",
            color: defaultPlayerColor,
            slot: "spectator",
            placement: "spectator",
            connected: true,
            isLeader: true
          }
        ],
        canStart: false,
        maxFunctionLength: 50,
        ...defaultLobbyGameplaySettings,
        createdAt: "2026-07-05T00:00:00.000Z"
      },
      selectedLobbySession: {
        guildId: "local-guild",
        roomId: "room-1",
        discordUserId: "alice-discord",
        playerId: "alice-player",
        alias: "Alice",
        color: defaultPlayerColor,
        slot: "player",
        sessionToken: "session-token"
      },
      session: {
        guildId: "local-guild",
        discordUserId: "alice-discord",
        playerId: "alice-player",
        defaultAlias: "Alice",
        displayName: "Alice",
        roomId: "room-1",
        source: "local"
      }
    });

    expect(identity.spectator).toBe(true);
    expect(identity.effectiveSession.playerId).toBe("alice-player");
    expect(identity.effectiveSession.displayName).toBe("Alice");
  });
});
