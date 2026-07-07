import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FunctionInput } from "./FunctionInput";

describe("FunctionInput", () => {
  it("renders a practical function palette for normal-function shots", () => {
    const html = renderToStaticMarkup(
      React.createElement(FunctionInput, {
        canSubmit: true,
        disabled: false,
        onSubmitShot: () => {}
      })
    );

    expect(html).toContain("Function Shot");
    expect(html).toContain("aria-label=\"Insert sine function\"");
    expect(html).toContain(">sin<");
    expect(html).toContain(">sqrt<");
    expect(html).toContain(">PI<");
    expect(html).toContain(">x^2<");
    expect(html).toContain(">wave<");
    expect(html).toContain("aria-label=\"Insert floor function\"");
    expect(html).toContain("aria-label=\"Insert ceiling function\"");
    expect(html).not.toContain("aria-label=\"Insert summation template\"");
    expect(html).not.toContain("aria-label=\"Insert gamma function\"");
    expect(html).not.toContain("aria-label=\"Insert zeta function\"");
  });

  it("renders compact advanced math palette buttons with accessible names when enabled", () => {
    const html = renderToStaticMarkup(
      React.createElement(FunctionInput, {
        advancedFunctionsEnabled: true,
        canSubmit: true,
        disabled: false,
        onSubmitShot: () => {}
      })
    );

    expect(html).toContain("aria-label=\"Insert summation template\"");
    expect(html).toContain("aria-label=\"Insert integral template\"");
    expect(html).toContain("aria-label=\"Insert second derivative template\"");
    expect(html).toContain("<sub>x</sub><sup>2</sup>");
    expect(html).toContain("aria-label=\"Insert gamma function\"");
    expect(html).toContain("aria-label=\"Insert continuous factorial function\"");
    expect(html).toContain("aria-label=\"Insert digamma function\"");
    expect(html).toContain("aria-label=\"Insert beta function\"");
    expect(html).toContain("aria-label=\"Insert zeta function\"");
    expect(html).toContain("aria-label=\"Insert floor function\"");
    expect(html).toContain("aria-label=\"Insert ceiling function\"");
  });

  it("disables the input, snippet buttons, and fire button together", () => {
    const html = renderToStaticMarkup(
      React.createElement(FunctionInput, {
        canSubmit: false,
        disabled: true,
        onSubmitShot: () => {}
      })
    );

    expect(html).toContain("id=\"shot-expression\"");
    expect(html).toContain("disabled=\"\"");
    expect(html).toMatch(/aria-label="Insert x variable"[^>]*disabled=""/);
    expect(html).toContain("class=\"primary-action\" disabled=\"\" type=\"submit\">Fire</button>");
  });
});
