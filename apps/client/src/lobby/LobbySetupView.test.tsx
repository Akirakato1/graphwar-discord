import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LobbySetupView } from "./LobbySetupView";

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
      isLeader: true
    },
    {
      discordUserId: "bob-id",
      playerId: "bob-id",
      alias: "Bob",
      slot: "spectator" as const,
      placement: "spectator" as const,
      connected: true,
      isLeader: false
    }
  ],
  canStart: false,
  startBlockedReason: "Team B needs at least one player.",
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
});
