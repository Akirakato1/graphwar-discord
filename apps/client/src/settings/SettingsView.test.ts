import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SettingsView } from "./SettingsView";

describe("SettingsView", () => {
  it("renders inside the full-height settings screen while preserving panel styling", () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsView, {
        onBack: () => undefined,
        onLoad: async () => undefined,
        onSave: async () => undefined,
        settings: { guildId: "local-guild", defaultMode: "team-versus", allowSpectators: true }
      })
    );

    expect(html).toContain('class="settings-screen"');
    expect(html).toContain('class="panel menu-panel"');
  });
});
