import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

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
});
