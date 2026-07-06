import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { insertSnippet } from "./insertSnippet";

type FunctionInputProps = {
  canSubmit: boolean;
  disabled: boolean;
  initialExpression?: string;
  onSubmitShot: (expression: string) => void;
};

type SnippetButton = {
  key: string;
  label: ReactNode;
  snippet: string;
  ariaLabel: string;
};

const snippetButtons: SnippetButton[] = [
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
  { key: "x-squared", label: "x^2", snippet: "x^2", ariaLabel: "Insert x squared template" },
  { key: "wave", label: "wave", snippet: "sin(x) + cos(x)", ariaLabel: "Insert wave template" },
  { key: "sum", label: "Σ", snippet: "sum(n,0,x,)", ariaLabel: "Insert summation template" },
  { key: "integral", label: "∫", snippet: "int(t,0,x,)", ariaLabel: "Insert integral template" },
  {
    key: "second-derivative",
    label: (
      <>
        D<sub>x</sub>
        <sup>2</sup>
      </>
    ),
    snippet: "diff(x,2,)",
    ariaLabel: "Insert second derivative template"
  },
  { key: "gamma", label: "Γ", snippet: "gamma()", ariaLabel: "Insert gamma function" },
  { key: "factorial", label: "!", snippet: "factorial()", ariaLabel: "Insert continuous factorial function" },
  { key: "digamma", label: "ψ", snippet: "digamma()", ariaLabel: "Insert digamma function" },
  { key: "beta", label: "Β", snippet: "beta(,)", ariaLabel: "Insert beta function" },
  { key: "floor", label: "⌊x⌋", snippet: "floor()", ariaLabel: "Insert floor function" },
  { key: "ceil", label: "⌈x⌉", snippet: "ceil()", ariaLabel: "Insert ceiling function" }
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
            key={button.key}
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
