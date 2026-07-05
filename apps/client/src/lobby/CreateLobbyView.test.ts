import { describe, expect, it } from "vitest";
import {
  availableInitialSlots,
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
        initialSlot: "player"
      })
    ).toEqual({
      form: {
        name: "Friday Graphwar",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player"
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
});
