import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { craterRadiusBounds, defaultPlayerColor, playerColorPalette } from "@graphwar/shared";
import { groupMoveAction, LobbySetupView, shouldConfirmLobbyCancellation } from "./LobbySetupView";

const lobby = {
  guildId: "local-guild",
  roomId: "room-1",
  name: "Friday Graphwar",
  mode: "team-versus" as const,
  status: "open" as const,
  leaderDiscordUserId: "alice-id",
  occupants: [
    {
      discordUserId: "alice-id",
      playerId: "alice-id",
      alias: "Alice",
      slot: "player" as const,
      placement: "team-a" as const,
      connected: true,
      isLeader: true,
      color: defaultPlayerColor
    },
    {
      discordUserId: "bob-id",
      playerId: "bob-id",
      alias: "Bob",
      slot: "spectator" as const,
      placement: "spectator" as const,
      connected: true,
      isLeader: false,
      color: playerColorPalette[2]
    }
  ],
  canStart: false,
  startBlockedReason: "Team B needs at least one player.",
  maxFunctionLength: 50,
  damagePerHit: 35,
  craterRadius: craterRadiusBounds.default,
  uniqueFunctionHits: true,
  friendlyFire: false,
  advancedFunctions: false,
  functionPreview: true,
  turnTimerEnabled: true,
  turnDurationSeconds: 60,
  inputMode: "hybrid" as const,
  createdAt: "2026-07-05T00:00:00.000Z"
};

describe("LobbySetupView", () => {
  it("shows team boxes, spectator box, auto assign, and leader-only start state", () => {
    const html = renderToStaticMarkup(
      <LobbySetupView
        currentPlayerId="alice-id"
        lobby={lobby}
        onAutoAssign={() => undefined}
        onBack={() => undefined}
        onMove={() => undefined}
        onStart={() => undefined}
      />
    );

    expect(html).toContain("Team A");
    expect(html).toContain("Team B");
    expect(html).toContain("Spectators");
    expect(html).toContain("Auto Assign");
    expect(html).toContain("Team B needs at least one player.");
  });

  it("shows leader crowns, player colors, and group-level move actions", () => {
    const html = renderToStaticMarkup(
      <LobbySetupView
        currentPlayerId="alice-player"
        lobby={{
          ...lobby,
          leaderDiscordUserId: "alice-discord",
          occupants: [
            {
              discordUserId: "alice-discord",
              playerId: "alice-player",
              alias: "Alice",
              slot: "player" as const,
              placement: "team-a" as const,
              connected: true,
              isLeader: true,
              color: defaultPlayerColor
            },
            {
              discordUserId: "bob-discord",
              playerId: "bob-player",
              alias: "Bob",
              slot: "player" as const,
              placement: "team-b" as const,
              connected: true,
              isLeader: false,
              color: playerColorPalette[2]
            }
          ]
        }}
        onAutoAssign={() => undefined}
        onBack={() => undefined}
        onMove={() => undefined}
        onStart={() => undefined}
      />
    );

    expect(html).toContain("Auto Assign");
    expect(html).toContain('aria-label="Lobby leader"');
    expect(html).toContain(`style="color:${defaultPlayerColor}"`);
    expect(html).toContain("Join B");
    expect(html).not.toContain('aria-label="Move Alice to Team B"');
    expect(html).not.toContain('aria-label="Move Bob to Team A"');
  });

  it("only enables group move actions for a movable local occupant outside the target group", () => {
    expect(
      groupMoveAction({
        currentPlacement: "team-a",
        currentPlayerId: "alice-id",
        isLeader: false,
        targetPlacement: "team-a"
      })
    ).toEqual({ label: "Join A", targetPlayerId: "alice-id", placement: "team-a", disabled: true });

    expect(
      groupMoveAction({
        currentPlacement: "team-a",
        currentPlayerId: "alice-id",
        isLeader: false,
        targetPlacement: "team-b"
      })
    ).toEqual({ label: "Join B", targetPlayerId: "alice-id", placement: "team-b", disabled: false });
  });

  it("only asks for lobby deletion confirmation when the open lobby owner returns to menu", () => {
    expect(
      shouldConfirmLobbyCancellation({
        currentDiscordUserId: "alice-id",
        currentPlayerId: "alice-id",
        lobby
      })
    ).toBe(true);

    expect(
      shouldConfirmLobbyCancellation({
        currentDiscordUserId: "bob-id",
        currentPlayerId: "bob-id",
        lobby
      })
    ).toBe(false);

    expect(
      shouldConfirmLobbyCancellation({
        currentDiscordUserId: "alice-id",
        currentPlayerId: "alice-id",
        lobby: { ...lobby, status: "playing", canStart: false, startBlockedReason: "Match has already started." }
      })
    ).toBe(false);
  });

  it("shows read-only gameplay rules before match start", () => {
    const html = renderToStaticMarkup(
      <LobbySetupView
        currentPlayerId="alice-id"
        lobby={{
          ...lobby,
          damagePerHit: 80,
          craterRadius: 2.5,
          uniqueFunctionHits: false,
          friendlyFire: true,
          advancedFunctions: true,
          functionPreview: false,
          turnTimerEnabled: false,
          turnDurationSeconds: 45,
          inputMode: "keypad"
        }}
        onAutoAssign={() => undefined}
        onBack={() => undefined}
        onMove={() => undefined}
        onStart={() => undefined}
      />
    );

    expect(html).toContain("Damage 80");
    expect(html).toContain("Crater 2.5");
    expect(html).toContain("Unique hits Off");
    expect(html).toContain("Friendly fire On");
    expect(html).toContain("Advanced functions On");
    expect(html).toContain("Preview Off");
    expect(html).toContain("Timer Off");
    expect(html).toContain("Input Keypad");
  });

  it("hides friendly-fire status for free-for-all setup", () => {
    const html = renderToStaticMarkup(
      <LobbySetupView
        currentPlayerId="alice-id"
        lobby={{
          ...lobby,
          mode: "free-for-all",
          friendlyFire: true,
          occupants: lobby.occupants.map((occupant) => ({ ...occupant, placement: "players" as const }))
        }}
        onAutoAssign={() => undefined}
        onBack={() => undefined}
        onMove={() => undefined}
        onStart={() => undefined}
      />
    );

    expect(html).toContain("Damage 35");
    expect(html).toContain("Unique hits On");
    expect(html).not.toContain("Friendly fire");
  });
});
