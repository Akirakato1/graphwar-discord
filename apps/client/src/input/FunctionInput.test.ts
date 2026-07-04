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
    expect(html).toContain(">pi<");
    expect(html).toContain(">x^2<");
    expect(html).toContain(">wave<");
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
