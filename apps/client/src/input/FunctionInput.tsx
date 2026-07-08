import { useRef, useState, type FormEvent, type ReactNode } from "react";
import type { FunctionInputMode } from "@graphwar/shared";
import { insertSnippet } from "./insertSnippet";

type FunctionInputProps = {
  advancedFunctionsEnabled?: boolean;
  canSubmit: boolean;
  disabled: boolean;
  expression?: string;
  inputMode?: FunctionInputMode;
  initialExpression?: string;
  onExpressionChange?: (expression: string) => void;
  onSubmitShot: (expression: string) => void;
};

type SnippetButton = {
  key: string;
  label: ReactNode;
  snippet: string;
  ariaLabel: string;
};

const normalSnippetButtons: SnippetButton[] = [
  { key: "sin", label: "sin", snippet: "sin()", ariaLabel: "Insert sine function" },
  { key: "cos", label: "cos", snippet: "cos()", ariaLabel: "Insert cosine function" },
  { key: "tan", label: "tan", snippet: "tan()", ariaLabel: "Insert tangent function" },
  { key: "sqrt", label: "sqrt", snippet: "sqrt()", ariaLabel: "Insert square root function" },
  { key: "log", label: "log", snippet: "log()", ariaLabel: "Insert logarithm function" },
  { key: "abs", label: "abs", snippet: "abs()", ariaLabel: "Insert absolute value function" },
  { key: "exp", label: "exp", snippet: "exp()", ariaLabel: "Insert exponential function" },
  { key: "x", label: "x", snippet: "x", ariaLabel: "Insert x variable" },
  { key: "pi", label: "PI", snippet: "PI", ariaLabel: "Insert pi constant" },
  { key: "e", label: "E", snippet: "E", ariaLabel: "Insert e constant" },
  { key: "power", label: "^", snippet: "^", ariaLabel: "Insert power operator" },
  { key: "parentheses", label: "()", snippet: "()", ariaLabel: "Insert parentheses" },
  { key: "floor", label: "⌊x⌋", snippet: "floor()", ariaLabel: "Insert floor function" },
  { key: "ceil", label: "⌈x⌉", snippet: "ceil()", ariaLabel: "Insert ceiling function" }
];

const keypadSnippetButtons: SnippetButton[] = [
  { key: "0", label: "0", snippet: "0", ariaLabel: "Insert 0" },
  { key: "1", label: "1", snippet: "1", ariaLabel: "Insert 1" },
  { key: "2", label: "2", snippet: "2", ariaLabel: "Insert 2" },
  { key: "3", label: "3", snippet: "3", ariaLabel: "Insert 3" },
  { key: "4", label: "4", snippet: "4", ariaLabel: "Insert 4" },
  { key: "5", label: "5", snippet: "5", ariaLabel: "Insert 5" },
  { key: "6", label: "6", snippet: "6", ariaLabel: "Insert 6" },
  { key: "7", label: "7", snippet: "7", ariaLabel: "Insert 7" },
  { key: "8", label: "8", snippet: "8", ariaLabel: "Insert 8" },
  { key: "9", label: "9", snippet: "9", ariaLabel: "Insert 9" },
  { key: "plus", label: "+", snippet: "+", ariaLabel: "Insert plus operator" },
  { key: "minus", label: "-", snippet: "-", ariaLabel: "Insert minus operator" },
  { key: "multiply", label: "*", snippet: "*", ariaLabel: "Insert multiplication operator" },
  { key: "divide", label: "/", snippet: "/", ariaLabel: "Insert division operator" },
  { key: "comma", label: ",", snippet: ",", ariaLabel: "Insert comma" }
];

const advancedSnippetButtons: SnippetButton[] = [
  { key: "sum", label: "Σ", snippet: "sum(n,0,x,)", ariaLabel: "Insert summation template" },
  { key: "integral", label: "∫", snippet: "int(t,0,x,)", ariaLabel: "Insert integral template" },
  {
    key: "derivative",
    label: (
      <>
        D<sub>x</sub>
      </>
    ),
    snippet: "diff(x,1,)",
    ariaLabel: "Insert derivative template"
  },
  { key: "gamma", label: "Γ", snippet: "gamma()", ariaLabel: "Insert gamma function" },
  { key: "digamma", label: "ψ", snippet: "digamma()", ariaLabel: "Insert digamma function" },
  { key: "beta", label: "Β", snippet: "beta(,)", ariaLabel: "Insert beta function" },
  { key: "zeta", label: "ζ", snippet: "zeta()", ariaLabel: "Insert zeta function" }
];

function splitTopLevelArguments(value: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth = Math.max(0, depth - 1);
    } else if (character === "," && depth === 0) {
      result.push(value.slice(start, index));
      start = index + 1;
    }
  }

  result.push(value.slice(start));
  return result;
}

function parseCall(expression: string, name: string): string[] | undefined {
  const prefix = `${name}(`;
  if (!expression.startsWith(prefix)) {
    return undefined;
  }

  const body = expression.endsWith(")") ? expression.slice(prefix.length, -1) : expression.slice(prefix.length);
  return splitTopLevelArguments(body);
}

function topLevelArgumentStarts(expression: string, name: string): number[] | undefined {
  const prefix = `${name}(`;
  if (!expression.startsWith(prefix)) {
    return undefined;
  }

  const starts = [prefix.length];
  let depth = 0;
  const scanEnd = expression.endsWith(")") ? expression.length - 1 : expression.length;
  for (let index = prefix.length; index < scanEnd; index += 1) {
    const character = expression[index];
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth = Math.max(0, depth - 1);
    } else if (character === "," && depth === 0) {
      starts.push(index + 1);
    }
  }

  return starts;
}

export function slotCursorPositionsForExpression(expression: string): number[] {
  const trimmedStartOffset = expression.length - expression.trimStart().length;
  const trimmed = expression.trimStart();
  const integral = topLevelArgumentStarts(trimmed, "int");
  if (integral && integral.length >= 4) {
    return [integral[1], integral[2], integral[3], integral[0]].map((position) => position + trimmedStartOffset);
  }

  const summation = topLevelArgumentStarts(trimmed, "sum");
  if (summation && summation.length >= 4) {
    return [summation[1], summation[2], summation[3], summation[0]].map((position) => position + trimmedStartOffset);
  }

  const derivative = topLevelArgumentStarts(trimmed, "diff");
  if (derivative && derivative.length >= 3) {
    return [derivative[0], derivative[1], derivative[2]].map((position) => position + trimmedStartOffset);
  }

  return [];
}

export function nextSlotCursorPosition(expression: string, cursorPosition: number, delta: number): number | undefined {
  const slots = slotCursorPositionsForExpression(expression);
  if (slots.length === 0 || delta === 0) {
    return undefined;
  }

  const sortedByVisualOrder = slots;
  const currentSlotIndex = sortedByVisualOrder.indexOf(cursorPosition);
  if (currentSlotIndex >= 0) {
    return sortedByVisualOrder[
      (currentSlotIndex + (delta > 0 ? 1 : -1) + sortedByVisualOrder.length) % sortedByVisualOrder.length
    ];
  }

  if (delta > 0) {
    return sortedByVisualOrder.find((slotPosition) => slotPosition > cursorPosition) ?? sortedByVisualOrder[0];
  }

  for (let index = sortedByVisualOrder.length - 1; index >= 0; index -= 1) {
    const slotPosition = sortedByVisualOrder[index];
    if (slotPosition < cursorPosition) {
      return slotPosition;
    }
  }

  return sortedByVisualOrder[sortedByVisualOrder.length - 1];
}

function slot(value: string | undefined, fallback: string): ReactNode {
  return value && value.length > 0 ? value : <span className="math-slot">{fallback}</span>;
}

function formatPlainExpression(expression: string): string {
  return expression
    .replace(/\bPI\b/g, "π")
    .replace(/\bgamma\b/g, "Γ")
    .replace(/\bdigamma\b/g, "ψ")
    .replace(/\bzeta\b/g, "ζ")
    .replace(/\bbeta\b/g, "Β");
}

function renderMathPreview(expression: string): ReactNode {
  const trimmed = expression.trim();
  const integral = parseCall(trimmed, "int");
  if (integral) {
    const [variable, lower, upper, body] = integral;
    return (
      <>
        <span className="math-operator">
          ∫<sub>{slot(lower, "lower")}</sub>
          <sup>{slot(upper, "upper")}</sup>
        </span>
        <span className="math-body">{slot(body, "body")}</span>
        <span className="math-differential"> d{slot(variable, "v")}</span>
      </>
    );
  }

  const summation = parseCall(trimmed, "sum");
  if (summation) {
    const [variable, lower, upper, body] = summation;
    return (
      <>
        <span className="math-operator">
          Σ<sub>{slot(`${variable || "n"}=${lower || ""}`, "n=lower")}</sub>
          <sup>{slot(upper, "upper")}</sup>
        </span>
        <span className="math-body">{slot(body, "body")}</span>
      </>
    );
  }

  const derivative = parseCall(trimmed, "diff");
  if (derivative) {
    const [variable, order, body] = derivative;
    return (
      <>
        <span className="math-operator">
          D<sub>{slot(variable, "x")}</sub>
          <sup>{slot(order, "1")}</sup>
        </span>
        <span className="math-body">{slot(body, "body")}</span>
      </>
    );
  }

  return formatPlainExpression(expression) || <span className="math-slot">f(x)</span>;
}

export function FunctionInput({
  advancedFunctionsEnabled = false,
  canSubmit,
  disabled,
  expression: controlledExpression,
  inputMode = "hybrid",
  initialExpression = "sin(x)",
  onExpressionChange,
  onSubmitShot
}: FunctionInputProps) {
  const [internalExpression, setInternalExpression] = useState(initialExpression);
  const inputRef = useRef<HTMLInputElement>(null);
  const expression = controlledExpression ?? internalExpression;
  const fireDisabled = disabled || !canSubmit || expression.trim().length === 0;
  const allowKeyboard = inputMode !== "keypad";
  const showKeypad = inputMode !== "keyboard";
  const snippetButtons = advancedFunctionsEnabled
    ? [...keypadSnippetButtons, ...normalSnippetButtons, ...advancedSnippetButtons]
    : [...keypadSnippetButtons, ...normalSnippetButtons];

  function restoreCursor(cursorPosition: number): void {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(cursorPosition, cursorPosition);
  }

  function updateExpression(nextExpression: string): void {
    if (controlledExpression === undefined) {
      setInternalExpression(nextExpression);
    }
    onExpressionChange?.(nextExpression);
  }

  function handleSnippetClick(snippet: string): void {
    if (disabled) {
      return;
    }

    const input = inputRef.current;
    const selectionStart = input?.selectionStart ?? expression.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const next = insertSnippet(expression, selectionStart, selectionEnd, snippet);
    updateExpression(next.value);

    if (typeof window === "undefined" || !window.requestAnimationFrame) {
      restoreCursor(next.cursorPosition);
      return;
    }

    window.requestAnimationFrame(() => restoreCursor(next.cursorPosition));
  }

  function moveCursor(delta: number): void {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const cursorPosition = input.selectionStart ?? expression.length;
    const slotCursorPosition = nextSlotCursorPosition(expression, cursorPosition, delta);
    restoreCursor(
      slotCursorPosition ?? Math.max(0, Math.min(expression.length, cursorPosition + delta))
    );
  }

  function deletePreviousCharacter(): void {
    if (disabled) {
      return;
    }

    const input = inputRef.current;
    const selectionStart = input?.selectionStart ?? expression.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);

    if (start !== end) {
      updateExpression(`${expression.slice(0, start)}${expression.slice(end)}`);
      restoreCursor(start);
      return;
    }

    if (start === 0) {
      restoreCursor(0);
      return;
    }

    updateExpression(`${expression.slice(0, start - 1)}${expression.slice(start)}`);
    restoreCursor(start - 1);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (disabled || !canSubmit) {
      return;
    }

    onSubmitShot(expression);
  }

  return (
    <form className="shot-form" onSubmit={handleSubmit}>
      <label htmlFor="shot-expression">Function Shot</label>
      <div className="math-preview" aria-label="Rendered function input">
        {renderMathPreview(expression)}
      </div>
      <div className="shot-row">
        <input
          autoComplete="off"
          disabled={disabled}
          id="shot-expression"
          onChange={(event) => updateExpression(event.target.value)}
          placeholder="sin(x)"
          readOnly={!allowKeyboard}
          ref={inputRef}
          value={expression}
        />
        <button className="primary-action" disabled={fireDisabled} type="submit">
          Fire
        </button>
      </div>
      {showKeypad ? (
        <>
          <div aria-label="Cursor controls" className="cursor-controls" role="group">
            <button
              aria-label="Move cursor left"
              className="snippet-button cursor-button"
              disabled={disabled}
              onClick={() => moveCursor(-1)}
              type="button"
            >
              ←
            </button>
            <button
              aria-label="Move cursor right"
              className="snippet-button cursor-button"
              disabled={disabled}
              onClick={() => moveCursor(1)}
              type="button"
            >
              →
            </button>
            <button
              aria-label="Delete previous character"
              className="snippet-button cursor-button"
              disabled={disabled}
              onClick={deletePreviousCharacter}
              type="button"
            >
              Del
            </button>
          </div>
          <div aria-label="Function snippet palette" className="snippet-palette" role="group">
            {snippetButtons.map((button) => (
              <button
                aria-label={button.ariaLabel}
                className="snippet-button"
                disabled={disabled}
                key={button.key}
                onClick={() => handleSnippetClick(button.snippet)}
                type="button"
              >
                {button.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </form>
  );
}
