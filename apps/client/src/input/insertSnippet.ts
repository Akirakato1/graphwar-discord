export type InsertSnippetResult = {
  cursorPosition: number;
  value: string;
};

function clampSelection(value: string, selection: number): number {
  if (!Number.isFinite(selection)) {
    return value.length;
  }

  return Math.max(0, Math.min(value.length, selection));
}

function cursorOffsetForSnippet(snippet: string): number {
  const emptyParenthesesIndex = snippet.indexOf("()");

  if (emptyParenthesesIndex >= 0) {
    return emptyParenthesesIndex + 1;
  }

  const trailingExpressionSlotIndex = snippet.indexOf(",)");
  if (trailingExpressionSlotIndex >= 0) {
    return trailingExpressionSlotIndex + 1;
  }

  return snippet.length;
}

export function insertSnippet(
  expression: string,
  selectionStart: number,
  selectionEnd: number,
  snippet: string
): InsertSnippetResult {
  const start = clampSelection(expression, selectionStart);
  const end = clampSelection(expression, selectionEnd);
  const replaceStart = Math.min(start, end);
  const replaceEnd = Math.max(start, end);
  const value = `${expression.slice(0, replaceStart)}${snippet}${expression.slice(replaceEnd)}`;

  return {
    value,
    cursorPosition: replaceStart + cursorOffsetForSnippet(snippet)
  };
}
