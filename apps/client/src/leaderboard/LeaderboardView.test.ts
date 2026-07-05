import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeaderboardView } from "./LeaderboardView";

describe("LeaderboardView", () => {
  it("renders inside the full-height leaderboard screen while preserving panel styling", () => {
    const html = renderToStaticMarkup(
      React.createElement(LeaderboardView, {
        entries: [],
        onBack: () => undefined,
        onLoad: async () => undefined
      })
    );

    expect(html).toContain('class="leaderboard-screen"');
    expect(html).toContain('class="panel menu-panel"');
  });
});
