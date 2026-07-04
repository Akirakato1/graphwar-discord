import { useRef, useState, type FormEvent } from "react";
import { insertSnippet } from "./insertSnippet";

type FunctionInputProps = {
  canSubmit: boolean;
  disabled: boolean;
  initialExpression?: string;
  onSubmitShot: (expression: string) => void;
};

type SnippetButton = {
  label: string;
  snippet: string;
  ariaLabel: string;
};

const snippetButtons: SnippetButton[] = [
  { label: "sin", snippet: "sin()", ariaLabel: "Insert sine function" },
  { label: "cos", snippet: "cos()", ariaLabel: "Insert cosine function" },
  { label: "tan", snippet: "tan()", ariaLabel: "Insert tangent function" },
  { label: "sqrt", snippet: "sqrt()", ariaLabel: "Insert square root function" },
  { label: "log", snippet: "log()", ariaLabel: "Insert logarithm function" },
  { label: "abs", snippet: "abs()", ariaLabel: "Insert absolute value function" },
  { label: "exp", snippet: "exp()", ariaLabel: "Insert exponential function" },
  { label: "x", snippet: "x", ariaLabel: "Insert x variable" },
  { label: "pi", snippet: "pi", ariaLabel: "Insert pi constant" },
  { label: "e", snippet: "e", ariaLabel: "Insert e constant" },
  { label: "^", snippet: "^", ariaLabel: "Insert power operator" },
  { label: "()", snippet: "()", ariaLabel: "Insert parentheses" },
  { label: "x^2", snippet: "x^2", ariaLabel: "Insert x squared template" },
  { label: "wave", snippet: "sin(x) + cos(x)", ariaLabel: "Insert wave template" }
];

export function FunctionInput({
  canSubmit,
  disabled,
  initialExpression = "sin(x)",
  onSubmitShot
}: FunctionInputProps) {
  const [expression, setExpression] = useState(initialExpression);
  const inputRef = useRef<HTMLInputElement>(null);
  const fireDisabled = disabled || !canSubmit || expression.trim().length === 0;

  function restoreCursor(cursorPosition: number): void {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(cursorPosition, cursorPosition);
  }

  function handleSnippetClick(snippet: string): void {
    if (disabled) {
      return;
    }

    const input = inputRef.current;
    const selectionStart = input?.selectionStart ?? expression.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const next = insertSnippet(expression, selectionStart, selectionEnd, snippet);
    setExpression(next.value);

    if (typeof window === "undefined" || !window.requestAnimationFrame) {
      restoreCursor(next.cursorPosition);
      return;
    }

    window.requestAnimationFrame(() => restoreCursor(next.cursorPosition));
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
      <div className="shot-row">
        <input
          autoComplete="off"
          disabled={disabled}
          id="shot-expression"
          onChange={(event) => setExpression(event.target.value)}
          placeholder="sin(x)"
          ref={inputRef}
          value={expression}
        />
        <button className="primary-action" disabled={fireDisabled} type="submit">
          Fire
        </button>
      </div>
      <div aria-label="Function snippet palette" className="snippet-palette" role="group">
        {snippetButtons.map((button) => (
          <button
            aria-label={button.ariaLabel}
            className="snippet-button"
            disabled={disabled}
            key={`${button.label}-${button.snippet}`}
            onClick={() => handleSnippetClick(button.snippet)}
            type="button"
          >
            {button.label}
          </button>
        ))}
      </div>
    </form>
  );
}
