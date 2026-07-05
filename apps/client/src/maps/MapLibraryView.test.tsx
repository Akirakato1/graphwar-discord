import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MapLibraryView } from "./MapLibraryView";

const map = {
  id: "map-1",
  guildId: "local-guild",
  ownerDiscordUserId: "alice",
  name: "Imported Arena",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z"
};

describe("MapLibraryView", () => {
  it("renders import controls and an empty state", () => {
    const html = renderToStaticMarkup(
      React.createElement(MapLibraryView, {
        currentDiscordUserId: "alice",
        customMaps: [],
        onBack: () => {},
        onDelete: async () => {},
        onImportText: async () => {}
      })
    );

    expect(html).toContain("Load Custom Map");
    expect(html).toContain("No custom maps yet.");
  });

  it("shows delete controls only for maps owned by the current user", () => {
    const html = renderToStaticMarkup(
      React.createElement(MapLibraryView, {
        currentDiscordUserId: "alice",
        customMaps: [map, { ...map, id: "map-2", ownerDiscordUserId: "bob", name: "Bob Arena" }],
        onBack: () => {},
        onDelete: async () => {},
        onImportText: async () => {}
      })
    );

    expect(html).toContain("Imported Arena");
    expect(html).toContain("Bob Arena");
    expect(html.match(/Delete/g)).toHaveLength(1);
  });

  it("keeps the map library shell and panel constrained on narrow viewports", () => {
    const styles = readFileSync(resolve(process.cwd(), "apps/client/src/styles.css"), "utf8");
    const sharedScreenRule = styles.match(
      /\.menu-screen,\s*\.lobby-setup-screen,\s*\.settings-screen,\s*\.leaderboard-screen,\s*\.map-library-screen\s*\{[^}]*display:\s*flex;[^}]*padding:\s*18px;/s
    );
    const panelRule = styles.match(/\.map-library-panel\s*\{[^}]*\}/s)?.[0] ?? "";

    expect(sharedScreenRule).not.toBeNull();
    expect(panelRule).toContain("box-sizing: border-box;");
    expect(panelRule).toContain("max-width: 100%;");
  });
});
