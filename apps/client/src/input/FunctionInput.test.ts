import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FunctionInput, nextSlotCursorPosition, slotCursorPositionsForExpression } from "./FunctionInput";

describe("FunctionInput", () => {
  it("orders template cursor slots visually for keypad navigation", () => {
    expect(slotCursorPositionsForExpression("int(t,0,x,)")).toEqual([6, 8, 10, 4]);
    expect(slotCursorPositionsForExpression("sum(n,0,x,)")).toEqual([6, 8, 10, 4]);
    expect(slotCursorPositionsForExpression("diff(x,1,)")).toEqual([5, 7, 9]);
    expect(nextSlotCursorPosition("int(t,0,x,)", 10, -1)).toBe(8);
    expect(nextSlotCursorPosition("int(t,0,x,)", 8, 1)).toBe(10);
  });

  it("renders a practical function palette for normal-function shots", () => {
    const html = renderToStaticMarkup(
      React.createElement(FunctionInput, {
        canSubmit: true,
        disabled: false,
        onSubmitShot: () => {}
      })
    );

    expect(html).toContain("Function Shot");
    expect(html).toContain("aria-label=\"Function expression editor\"");
    expect(html).toContain("class=\"math-editor-display\"");
    expect(html).toContain("class=\"math-cursor\"");
    expect(html).toContain("aria-label=\"Edit controls\"");
    expect(html).toContain("aria-label=\"Number buttons\"");
    expect(html).toContain("aria-label=\"Operation buttons\"");
    expect(html).toContain("aria-label=\"Function buttons\"");
    expect(html).toContain(">+<");
    expect(html).toContain("aria-label=\"Insert multiplication operator\"");
    expect(html).toContain("aria-label=\"Insert division operator\"");
    expect(html).toContain("aria-label=\"Insert sine function\"");
    expect(html).toContain(">sin<");
    expect(html).toContain(">sqrt<");
    expect(html).toContain(">PI<");
    expect(html).toContain(">^<");
    expect(html).not.toContain(">x^2<");
    expect(html).not.toContain(">wave<");
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
    expect(html).toContain("aria-label=\"Insert derivative template\"");
    expect(html).toContain("<sub>x</sub>");
    expect(html).not.toContain("<sup>2</sup>");
    expect(html).toContain("aria-label=\"Insert gamma function\"");
    expect(html).not.toContain("aria-label=\"Insert continuous factorial function\"");
    expect(html).toContain("aria-label=\"Insert digamma function\"");
    expect(html).toContain("aria-label=\"Insert beta function\"");
    expect(html).toContain("aria-label=\"Insert zeta function\"");
    expect(html).toContain("aria-label=\"Insert floor function\"");
    expect(html).toContain("aria-label=\"Insert ceiling function\"");
    expect(html).toContain("aria-label=\"Function buttons\"");
    expect(html).not.toContain("aria-label=\"Advanced function buttons\"");
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

  it("renders a live math display and keypad controls in keypad mode", () => {
    const html = renderToStaticMarkup(
      React.createElement(FunctionInput, {
        advancedFunctionsEnabled: true,
        canSubmit: true,
        disabled: false,
        expression: "int(t,0,x,)",
        inputMode: "keypad",
        onSubmitShot: () => {}
      })
    );

    expect(html).toContain("class=\"math-editor-display\"");
    expect(html).toContain("class=\"math-cursor\"");
    expect(html).toContain("aria-label=\"Move cursor left\"");
    expect(html).toContain("aria-label=\"Delete previous character\"");
    expect(html).toContain("aria-label=\"Insert integral template\"");
    expect(html).toContain("readonly=\"\"");
  });

  it("hides keypad buttons in keyboard-only mode while keeping direct editing", () => {
    const html = renderToStaticMarkup(
      React.createElement(FunctionInput, {
        canSubmit: true,
        disabled: false,
        inputMode: "keyboard",
        onSubmitShot: () => {}
      })
    );

    expect(html).toContain("id=\"shot-expression\"");
    expect(html).not.toContain("readonly=\"\"");
    expect(html).not.toContain("aria-label=\"Insert sine function\"");
    expect(html).not.toContain("aria-label=\"Move cursor left\"");
    expect(html).toContain("aria-label=\"Function expression editor\"");
  });
});
