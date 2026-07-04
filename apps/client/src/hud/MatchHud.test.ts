import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MatchHud } from "./MatchHud";

const session = {
  playerId: "alice",
  displayName: "Alice",
  roomId: "local-test",
  source: "local" as const
};

describe("MatchHud", () => {
  it("shows the latest local error instead of a stale rejection when both are present", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatchHud, {
        connectionStatus: "open",
        lastError: "Enter a function before submitting a shot.",
        lastRejection: { playerId: "alice", reason: "Player is not active" },
        onSubmitShot: () => {},
        session
      })
    );

    expect(html).toContain("Enter a function before submitting a shot.");
    expect(html).not.toContain("Player is not active");
  });
});
