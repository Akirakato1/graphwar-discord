import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  availableInitialSlots,
  CreateLobbyView,
  createLobbyErrorMessage,
  createLobbyInitialForm,
  prepareCreateLobbyForm
} from "./CreateLobbyView";

describe("CreateLobbyView helpers", () => {
  it("trims lobby name and alias before creating", () => {
    expect(
      prepareCreateLobbyForm({
        name: "  Friday Graphwar  ",
        alias: "  Alice  ",
        mode: "team-versus",
        initialSlot: "player",
        mapId: "map-1"
      })
    ).toEqual({
      form: {
        name: "Friday Graphwar",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        mapId: "map-1"
      }
    });
  });

  it("returns visible error text for failed create requests", () => {
    expect(createLobbyErrorMessage(new Error("Lobby name is already taken."))).toBe("Lobby name is already taken.");
    expect(createLobbyErrorMessage("failed")).toBe("Could not create lobby.");
  });

  it("uses guild settings for default mode and spectator availability", () => {
    const settings = { guildId: "local-guild", defaultMode: "free-for-all" as const, allowSpectators: false };

    expect(createLobbyInitialForm("Alice", settings)).toEqual({
      name: "Graphwar Lobby",
      alias: "Alice",
      mode: "free-for-all",
      initialSlot: "player"
    });
    expect(availableInitialSlots(settings)).toEqual(["player"]);
  });

  it("renders default and custom map choices", () => {
    const html = renderToStaticMarkup(
      React.createElement(CreateLobbyView, {
        defaultAlias: "Alice",
        customMaps: [
          {
            id: "map-1",
            guildId: "local-guild",
            ownerDiscordUserId: "alice",
            name: "Imported Arena",
            createdAt: "2026-07-05T00:00:00.000Z",
            updatedAt: "2026-07-05T00:00:00.000Z"
          }
        ],
        onBack: () => {},
        onCreate: async () => {},
        settings: { guildId: "local-guild", defaultMode: "team-versus", allowSpectators: true }
      })
    );

    expect(html).toContain("Map");
    expect(html).toContain("Default Map");
    expect(html).toContain("Imported Arena");
  });
});
