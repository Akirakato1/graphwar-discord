import { readFileSync } from "node:fs";
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
import {
  craterRadiusBounds,
  damagePerHitBounds,
  defaultMapSizePreset,
  defaultPlayerColor,
  playerColorPalette
} from "@graphwar/shared";

describe("CreateLobbyView helpers", () => {
  it("trims lobby name and alias before creating", () => {
    expect(
      prepareCreateLobbyForm({
        name: "  Friday Graphwar  ",
        alias: "  Alice  ",
        mode: "team-versus",
        initialSlot: "player",
        color: playerColorPalette[1],
        maxFunctionLength: 72,
        damagePerHit: damagePerHitBounds.default,
        craterRadius: craterRadiusBounds.default,
        uniqueFunctionHits: true,
        friendlyFire: false,
        advancedFunctions: true,
        functionPreview: false,
        mapId: "map-1"
      })
    ).toEqual({
      form: {
        name: "Friday Graphwar",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        color: playerColorPalette[1],
        maxFunctionLength: 72,
        damagePerHit: damagePerHitBounds.default,
        craterRadius: craterRadiusBounds.default,
        uniqueFunctionHits: true,
        friendlyFire: false,
        advancedFunctions: true,
        functionPreview: false,
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
      initialSlot: "player",
      color: defaultPlayerColor,
      maxFunctionLength: 50,
      damagePerHit: damagePerHitBounds.default,
      craterRadius: craterRadiusBounds.default,
      uniqueFunctionHits: true,
      friendlyFire: false,
      advancedFunctions: false,
      functionPreview: true,
      mapSizePreset: defaultMapSizePreset
    });
    expect(availableInitialSlots(settings)).toEqual(["player"]);
  });

  it("defaults default-map size to standard", () => {
    expect(createLobbyInitialForm("Alice").mapSizePreset).toBe("standard");
  });

  it("defaults and prepares phase 2 gameplay settings", () => {
    expect(createLobbyInitialForm("Alice")).toEqual(
      expect.objectContaining({
        damagePerHit: damagePerHitBounds.default,
        craterRadius: craterRadiusBounds.default,
        uniqueFunctionHits: true,
        friendlyFire: false,
        advancedFunctions: false,
        functionPreview: true
      })
    );

    expect(
      prepareCreateLobbyForm({
        name: "Arena",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        color: defaultPlayerColor,
        maxFunctionLength: 50,
        damagePerHit: 83,
        craterRadius: 2.5,
        uniqueFunctionHits: false,
        friendlyFire: true,
        advancedFunctions: true,
        functionPreview: false
      }).form
    ).toEqual(
      expect.objectContaining({
        damagePerHit: 83,
        craterRadius: 2.5,
        uniqueFunctionHits: false,
        friendlyFire: true,
        advancedFunctions: true,
        functionPreview: false
      })
    );
  });

  it("does not submit stale friendly-fire values for free-for-all lobbies", () => {
    expect(
      prepareCreateLobbyForm({
        name: "Arena",
        alias: "Alice",
        mode: "free-for-all",
        initialSlot: "player",
        color: defaultPlayerColor,
        maxFunctionLength: 50,
        damagePerHit: damagePerHitBounds.default,
        craterRadius: craterRadiusBounds.default,
        uniqueFunctionHits: true,
        friendlyFire: true,
        advancedFunctions: true,
        functionPreview: true
      }).form
    ).toEqual(
      expect.objectContaining({ mode: "free-for-all", friendlyFire: false, advancedFunctions: true, functionPreview: true })
    );
  });

  it("preserves map size presets for the default map", () => {
    expect(
      prepareCreateLobbyForm({
        name: "Arena",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        color: defaultPlayerColor,
        maxFunctionLength: 50,
        damagePerHit: damagePerHitBounds.default,
        craterRadius: craterRadiusBounds.default,
        uniqueFunctionHits: true,
        friendlyFire: false,
        advancedFunctions: false,
        functionPreview: true,
        mapSizePreset: "huge"
      })
    ).toEqual({
      form: {
        name: "Arena",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        color: defaultPlayerColor,
        maxFunctionLength: 50,
        damagePerHit: damagePerHitBounds.default,
        craterRadius: craterRadiusBounds.default,
        uniqueFunctionHits: true,
        friendlyFire: false,
        advancedFunctions: false,
        functionPreview: true,
        mapSizePreset: "huge"
      }
    });
  });

  it("omits map size presets when a custom map is selected", () => {
    expect(
      prepareCreateLobbyForm({
        name: "Arena",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        color: defaultPlayerColor,
        maxFunctionLength: 50,
        damagePerHit: damagePerHitBounds.default,
        craterRadius: craterRadiusBounds.default,
        uniqueFunctionHits: true,
        friendlyFire: false,
        advancedFunctions: false,
        functionPreview: true,
        mapId: "map-1",
        mapSizePreset: "huge"
      })
    ).toEqual({
      form: {
        name: "Arena",
        alias: "Alice",
        mode: "team-versus",
        initialSlot: "player",
        color: defaultPlayerColor,
        maxFunctionLength: 50,
        damagePerHit: damagePerHitBounds.default,
        craterRadius: craterRadiusBounds.default,
        uniqueFunctionHits: true,
        friendlyFire: false,
        advancedFunctions: false,
        functionPreview: true,
        mapId: "map-1"
      }
    });
  });

  it("renders lobby identity and custom map choices", () => {
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
    expect(html).toContain("Map size");
    expect(html).toContain('option value="small"');
    expect(html).toContain('option value="standard"');
    expect(html).toContain('option value="large"');
    expect(html).toContain('option value="huge"');
    expect(html).toContain("Color");
    expect(html).toContain("Max function length");
    expect(html).toContain('min="20"');
    expect(html).toContain('max="100"');
  });

  it("renders compact gameplay setting controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(CreateLobbyView, {
        defaultAlias: "Alice",
        onBack: () => {},
        onCreate: async () => {}
      })
    );

    expect(html).toContain("Damage");
    expect(html).toContain('type="range"');
    expect(html).toContain(`min="${damagePerHitBounds.min}"`);
    expect(html).toContain(`max="${damagePerHitBounds.max}"`);
    expect(html).toContain("Crater radius");
    expect(html).toContain(`min="${craterRadiusBounds.min}"`);
    expect(html).toContain(`max="${craterRadiusBounds.max}"`);
    expect(html).toContain(`step="${craterRadiusBounds.step}"`);
    expect(html).toContain("Unique function hits");
    expect(html).toContain("Advanced functions");
    expect(html).toContain("Function preview");
    expect(html).toContain("Friendly fire");
  });

  it("keeps the compact create-lobby layout dense enough for the extra map-size row", () => {
    const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const compactLandscapeBlock = styles.match(/@media \(max-width: 820px\) and \(orientation: landscape\) \{([\s\S]*)\}\s*$/);

    expect(styles).toContain(".create-lobby-panel");
    expect(styles).toMatch(/\.create-lobby-form\s*\{[^}]*overflow-y:\s*auto;/s);
    expect(compactLandscapeBlock?.[1]).toContain(".create-lobby-form");
    expect(compactLandscapeBlock?.[1]).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(compactLandscapeBlock?.[1]).toContain("overflow-y: auto;");
    expect(compactLandscapeBlock?.[1]).toContain(".create-lobby-form .color-selector");
    expect(compactLandscapeBlock?.[1]).toContain("grid-column: 1 / -1;");
  });
});
