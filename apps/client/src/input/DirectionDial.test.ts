import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { aimDirections } from "@graphwar/shared";
import { DirectionDial, nextAimDirection } from "./DirectionDial";

describe("DirectionDial", () => {
  it("renders all 8 aim directions with the selected direction marked", () => {
    const html = renderToStaticMarkup(
      React.createElement(DirectionDial, {
        disabled: false,
        onChange: () => {},
        value: "west"
      })
    );

    for (const direction of aimDirections) {
      expect(html).toContain(`aria-label="Aim ${direction}"`);
    }
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-direction="west"');
  });

  it("keeps the selected east label in a stable visible layer", () => {
    const html = renderToStaticMarkup(
      React.createElement(DirectionDial, {
        disabled: false,
        onChange: () => {},
        value: "east"
      })
    );
    const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

    expect(html).toContain('data-direction="east"');
    expect(html).toContain('<span class="direction-button-label">E</span>');
    expect(styles).toMatch(/\.direction-button\s*\{[^}]*display:\s*grid;/s);
    expect(styles).toMatch(/\.direction-button-label\s*\{[^}]*z-index:\s*1;/s);
  });

  it("disables every direction button when aiming is disabled", () => {
    const html = renderToStaticMarkup(
      React.createElement(DirectionDial, {
        disabled: true,
        onChange: () => {},
        value: "east"
      })
    );

    expect(html.match(/disabled=""/g)).toHaveLength(aimDirections.length);
  });

  it("steps through directions for mouse wheel deltas", () => {
    expect(nextAimDirection("east", 1)).toBe("north-east");
    expect(nextAimDirection("east", -1)).toBe("south-east");
    expect(nextAimDirection("east", -9)).toBe("south-east");
    expect(nextAimDirection("south-east", 1)).toBe("east");
  });
});
