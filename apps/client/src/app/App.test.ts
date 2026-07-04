import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the local multiplayer control surface", () => {
    const html = renderToStaticMarkup(React.createElement(App));

    expect(html).toContain("Connection");
    expect(html).toContain("Lobby");
    expect(html).toContain("Start Match");
    expect(html).toContain("Recent Events");
  });
});
