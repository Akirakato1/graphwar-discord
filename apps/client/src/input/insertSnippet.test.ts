import { describe, expect, it } from "vitest";
import { insertSnippet } from "./insertSnippet";

describe("insertSnippet", () => {
  it("inserts a function snippet at the cursor with the cursor inside empty parentheses", () => {
    expect(insertSnippet("x + ", 4, 4, "sin()")).toEqual({
      value: "x + sin()",
      cursorPosition: 8
    });
  });

  it("replaces selected text with a snippet and leaves the cursor after plain snippets", () => {
    expect(insertSnippet("sin(x) + y", 9, 10, "pi")).toEqual({
      value: "sin(x) + pi",
      cursorPosition: 11
    });
  });

  it("preserves surrounding text when inserting in the middle of an expression", () => {
    expect(insertSnippet("2 * x", 4, 4, "^2")).toEqual({
      value: "2 * ^2x",
      cursorPosition: 6
    });
  });

  it("places the cursor in the trailing expression slot for operator templates", () => {
    expect(insertSnippet("", 0, 0, "diff(x,1,)")).toEqual({
      value: "diff(x,1,)",
      cursorPosition: 9
    });
  });
});
