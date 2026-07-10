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

type CursorSelection = {
  start: number;
  end: number;
};

const numberSnippetButtons: SnippetButton[] = [
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
  { key: "decimal", label: ".", snippet: ".", ariaLabel: "Insert decimal point" },
  { key: "comma", label: ",", snippet: ",", ariaLabel: "Insert comma" }
];

const operationSnippetButtons: SnippetButton[] = [
  { key: "plus", label: "+", snippet: "+", ariaLabel: "Insert plus operator" },
  { key: "minus", label: "-", snippet: "-", ariaLabel: "Insert minus operator" },
  { key: "multiply", label: "*", snippet: "*", ariaLabel: "Insert multiplication operator" },
  { key: "divide", label: "/", snippet: "/", ariaLabel: "Insert division operator" },
  { key: "power", label: "^", snippet: "^", ariaLabel: "Insert power operator" },
  { key: "parentheses", label: "()", snippet: "()", ariaLabel: "Insert parentheses" }
];

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
  { key: "floor", label: "⌊x⌋", snippet: "floor()", ariaLabel: "Insert floor function" },
  { key: "ceil", label: "⌈x⌉", snippet: "ceil()", ariaLabel: "Insert ceiling function" }
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

  const currentSlotIndex = slots.indexOf(cursorPosition);
  if (currentSlotIndex >= 0) {
    return slots[(currentSlotIndex + (delta > 0 ? 1 : -1) + slots.length) % slots.length];
  }

  if (delta > 0) {
    return slots.find((slotPosition) => slotPosition > cursorPosition) ?? slots[0];
  }

  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const slotPosition = slots[index];
    if (slotPosition < cursorPosition) {
      return slotPosition;
    }
  }

  return slots[slots.length - 1];
}

function clampPosition(value: string, position: number): number {
  if (!Number.isFinite(position)) {
    return value.length;
  }

  return Math.max(0, Math.min(value.length, position));
}

function mathCursor(): ReactNode {
  return <span aria-hidden="true" className="math-cursor" />;
}

function formatPlainExpression(expression: string): string {
  return expression
    .replace(/\bPI\b/g, "π")
    .replace(/\bgamma\b/g, "Γ")
    .replace(/\bdigamma\b/g, "ψ")
    .replace(/\bzeta\b/g, "ζ")
    .replace(/\bbeta\b/g, "Β");
}

function isIdentifierStart(character: string | undefined): boolean {
  return Boolean(character && /[A-Za-z_]/.test(character));
}

function isIdentifierPart(character: string | undefined): boolean {
  return Boolean(character && /[A-Za-z0-9_]/.test(character));
}

function matchingClosingParen(expression: string, openIndex: number, endIndex: number): number | undefined {
  let depth = 0;
  for (let index = openIndex; index < endIndex; index += 1) {
    const character = expression[index];
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return undefined;
}

function argumentStartsInCall(expression: string, openIndex: number, closeIndex: number): number[] {
  const starts = [openIndex + 1];
  let depth = 0;
  for (let index = openIndex + 1; index < closeIndex; index += 1) {
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

function renderPlainChunk(expression: string, absoluteStart: number, cursorPosition: number, key: string): ReactNode {
  const localCursor = cursorPosition - absoluteStart;
  if (localCursor < 0 || localCursor > expression.length) {
    return formatPlainExpression(expression);
  }

  return (
    <span key={key}>
      {formatPlainExpression(expression.slice(0, localCursor))}
      {mathCursor()}
      {formatPlainExpression(expression.slice(localCursor))}
    </span>
  );
}

function functionSymbol(name: string): string {
  switch (name) {
    case "PI":
      return "π";
    case "gamma":
      return "Γ";
    case "digamma":
      return "ψ";
    case "beta":
      return "Β";
    case "zeta":
      return "ζ";
    default:
      return name;
  }
}

function renderFunctionCall(
  name: string,
  argumentValues: string[],
  argumentStarts: number[],
  cursorPosition: number,
  key: string
): ReactNode {
  const renderArgument = (index: number, fallback = "") =>
    renderInlineMath(argumentValues[index] ?? fallback, argumentStarts[index] ?? 0, cursorPosition);

  if (name === "floor") {
    return (
      <span className="math-bracketed" key={key}>
        ⌊{renderArgument(0)}⌋
      </span>
    );
  }

  if (name === "ceil") {
    return (
      <span className="math-bracketed" key={key}>
        ⌈{renderArgument(0)}⌉
      </span>
    );
  }

  if (name === "exp") {
    return (
      <span className="math-power" key={key}>
        e<sup>{renderArgument(0)}</sup>
      </span>
    );
  }

  return (
    <span className="math-function-call" key={key}>
      <span className="math-function-name">{functionSymbol(name)}</span>(
      {argumentValues.map((argument, index) => (
        <span key={`${key}-arg-${index}`}>
          {index > 0 ? "," : ""}
          {renderInlineMath(argument, argumentStarts[index] ?? 0, cursorPosition)}
        </span>
      ))}
      )
    </span>
  );
}

type ParsedAtom = {
  node: ReactNode;
  nextIndex: number;
};

function parseInlineAtom(
  expression: string,
  absoluteStart: number,
  cursorPosition: number,
  startIndex: number,
  endIndex: number,
  key: string
): ParsedAtom {
  const character = expression[startIndex];

  if (character === "(") {
    const closeIndex = matchingClosingParen(expression, startIndex, endIndex);
    if (closeIndex !== undefined) {
      return {
        nextIndex: closeIndex + 1,
        node: (
          <span className="math-parenthesized" key={key}>
            ({renderInlineMath(expression.slice(startIndex + 1, closeIndex), absoluteStart + startIndex + 1, cursorPosition)})
          </span>
        )
      };
    }
  }

  if (isIdentifierStart(character)) {
    let identifierEnd = startIndex + 1;
    while (identifierEnd < endIndex && isIdentifierPart(expression[identifierEnd])) {
      identifierEnd += 1;
    }

    if (expression[identifierEnd] === "(") {
      const closeIndex = matchingClosingParen(expression, identifierEnd, endIndex);
      if (closeIndex !== undefined) {
        const body = expression.slice(identifierEnd + 1, closeIndex);
        return {
          nextIndex: closeIndex + 1,
          node: renderFunctionCall(
            expression.slice(startIndex, identifierEnd),
            splitTopLevelArguments(body),
            argumentStartsInCall(expression, identifierEnd, closeIndex).map((position) => absoluteStart + position),
            cursorPosition,
            key
          )
        };
      }
    }

    return {
      nextIndex: identifierEnd,
      node: renderPlainChunk(expression.slice(startIndex, identifierEnd), absoluteStart + startIndex, cursorPosition, key)
    };
  }

  if (/[0-9.]/.test(character)) {
    let numberEnd = startIndex + 1;
    while (numberEnd < endIndex && /[0-9.]/.test(expression[numberEnd])) {
      numberEnd += 1;
    }

    return {
      nextIndex: numberEnd,
      node: renderPlainChunk(expression.slice(startIndex, numberEnd), absoluteStart + startIndex, cursorPosition, key)
    };
  }

  return {
    nextIndex: startIndex + 1,
    node: renderPlainChunk(character, absoluteStart + startIndex, cursorPosition, key)
  };
}

function renderInlineMath(expression: string, absoluteStart: number, cursorPosition: number): ReactNode {
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < expression.length) {
    const atom = parseInlineAtom(expression, absoluteStart, cursorPosition, index, expression.length, `atom-${absoluteStart}-${index}`);
    index = atom.nextIndex;

    if (expression[index] === "^") {
      const exponentStart = index + 1;
      if (exponentStart < expression.length) {
        const exponent = parseInlineAtom(
          expression,
          absoluteStart,
          cursorPosition,
          exponentStart,
          expression.length,
          `exponent-${absoluteStart}-${exponentStart}`
        );
        nodes.push(
          <span className="math-power" key={`power-${absoluteStart}-${index}`}>
            {atom.node}
            <sup>{exponent.node}</sup>
          </span>
        );
        index = exponent.nextIndex;
        continue;
      }
    }

    nodes.push(atom.node);
  }

  if (cursorPosition === absoluteStart + expression.length) {
    nodes.push(<span key={`cursor-${absoluteStart}-${expression.length}`}>{mathCursor()}</span>);
  }

  return nodes.length > 0 ? nodes : null;
}

function renderPlainWithCursor(
  expression: string,
  absoluteStart: number,
  cursorPosition: number,
  emptyFallback = "f(x)"
): ReactNode {
  const localCursor = cursorPosition - absoluteStart;
  if (localCursor < 0 || localCursor > expression.length) {
    return formatPlainExpression(expression);
  }

  if (expression.length === 0) {
    return (
      <>
        {mathCursor()}
        <span className="math-slot">{emptyFallback}</span>
      </>
    );
  }

  return (
    <>
      {formatPlainExpression(expression.slice(0, localCursor))}
      {mathCursor()}
      {formatPlainExpression(expression.slice(localCursor))}
    </>
  );
}

function renderSlot(value: string | undefined, fallback: string, absoluteStart: number, cursorPosition: number): ReactNode {
  const slotValue = value ?? "";
  if (cursorPosition >= absoluteStart && cursorPosition <= absoluteStart + slotValue.length) {
    return (
      <span className="math-slot-value">{renderInlineMath(slotValue, absoluteStart, cursorPosition)}</span>
    );
  }

  return slotValue.length > 0 ? renderInlineMath(slotValue, absoluteStart, cursorPosition) : <span className="math-slot">{fallback}</span>;
}

function cursorInArgument(argumentsList: string[], starts: number[], cursorPosition: number): boolean {
  return starts.some((start, index) => {
    const value = argumentsList[index] ?? "";
    return cursorPosition >= start && cursorPosition <= start + value.length;
  });
}

function renderMathPreview(expression: string, cursorPosition: number): ReactNode {
  const clampedCursor = clampPosition(expression, cursorPosition);
  const trimmedStartOffset = expression.length - expression.trimStart().length;
  const trimmed = expression.trimStart();
  const integral = parseCall(trimmed, "int");
  const integralStarts = topLevelArgumentStarts(trimmed, "int")?.map((position) => position + trimmedStartOffset);
  if (integral && integralStarts && integralStarts.length >= 4) {
    const [variable, lower, upper, body] = integral;
    return (
      <>
        <span className="math-operator">
          ∫<sub>{renderSlot(lower, "lower", integralStarts[1], clampedCursor)}</sub>
          <sup>{renderSlot(upper, "upper", integralStarts[2], clampedCursor)}</sup>
        </span>
        <span className="math-body">{renderSlot(body, "body", integralStarts[3], clampedCursor)}</span>
        <span className="math-differential"> d{renderSlot(variable, "v", integralStarts[0], clampedCursor)}</span>
        {!cursorInArgument(integral, integralStarts, clampedCursor) && clampedCursor === expression.length ? mathCursor() : null}
      </>
    );
  }

  const summation = parseCall(trimmed, "sum");
  const summationStarts = topLevelArgumentStarts(trimmed, "sum")?.map((position) => position + trimmedStartOffset);
  if (
    summation &&
    summationStarts &&
    summationStarts.length >= 4 &&
    true
  ) {
    const [variable, lower, upper, body] = summation;
    return (
      <>
        <span className="math-operator">
          Σ
          <sub>
            {renderSlot(variable, "n", summationStarts[0], clampedCursor)}=
            {renderSlot(lower, "lower", summationStarts[1], clampedCursor)}
          </sub>
          <sup>{renderSlot(upper, "upper", summationStarts[2], clampedCursor)}</sup>
        </span>
        <span className="math-body">{renderSlot(body, "body", summationStarts[3], clampedCursor)}</span>
        {!cursorInArgument(summation, summationStarts, clampedCursor) && clampedCursor === expression.length ? mathCursor() : null}
      </>
    );
  }

  const derivative = parseCall(trimmed, "diff");
  const derivativeStarts = topLevelArgumentStarts(trimmed, "diff")?.map((position) => position + trimmedStartOffset);
  if (
    derivative &&
    derivativeStarts &&
    derivativeStarts.length >= 3 &&
    true
  ) {
    const [variable, order, body] = derivative;
    return (
      <>
        <span className="math-operator">
          D<sub>{renderSlot(variable, "x", derivativeStarts[0], clampedCursor)}</sub>
          <sup>{renderSlot(order, "1", derivativeStarts[1], clampedCursor)}</sup>
        </span>
        <span className="math-body">{renderSlot(body, "body", derivativeStarts[2], clampedCursor)}</span>
        {!cursorInArgument(derivative, derivativeStarts, clampedCursor) && clampedCursor === expression.length ? mathCursor() : null}
      </>
    );
  }

  return expression.length > 0 ? renderInlineMath(expression, 0, clampedCursor) : renderPlainWithCursor(expression, 0, clampedCursor);
}

function renderButtonGrid(buttons: SnippetButton[], disabled: boolean, onClick: (snippet: string) => void): ReactNode {
  return buttons.map((button) => (
    <button
      aria-label={button.ariaLabel}
      className="snippet-button"
      data-game-sound="function.button"
      disabled={disabled}
      key={button.key}
      onClick={() => onClick(button.snippet)}
      type="button"
    >
      {button.label}
    </button>
  ));
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
  const [selection, setSelection] = useState<CursorSelection>({
    start: initialExpression.length,
    end: initialExpression.length
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const expression = controlledExpression ?? internalExpression;
  const cursorPosition = clampPosition(expression, selection.end);
  const fireDisabled = disabled || !canSubmit || expression.trim().length === 0;
  const allowKeyboard = inputMode !== "keypad";
  const showKeypad = inputMode !== "keyboard";
  const functionButtons = advancedFunctionsEnabled
    ? [...normalSnippetButtons, ...advancedSnippetButtons]
    : normalSnippetButtons;

  function updateStoredSelectionFor(value: string, start: number, end = start): void {
    setSelection({
      start: clampPosition(value, start),
      end: clampPosition(value, end)
    });
  }

  function readSelection(): CursorSelection {
    const input = inputRef.current;
    if (
      input &&
      typeof document !== "undefined" &&
      document.activeElement === input &&
      input.selectionStart !== null &&
      input.selectionEnd !== null
    ) {
      return { start: input.selectionStart, end: input.selectionEnd };
    }

    return selection;
  }

  function restoreCursor(nextCursorPosition: number, nextExpression = expression): void {
    const clampedCursor = clampPosition(nextExpression, nextCursorPosition);
    setSelection({ start: clampedCursor, end: clampedCursor });

    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(clampedCursor, clampedCursor);
  }

  function updateExpression(nextExpression: string): void {
    if (controlledExpression === undefined) {
      setInternalExpression(nextExpression);
    }
    onExpressionChange?.(nextExpression);
  }

  function handleInputSelection(): void {
    const input = inputRef.current;
    if (!input || input.selectionStart === null || input.selectionEnd === null) {
      return;
    }

    setSelection({ start: input.selectionStart, end: input.selectionEnd });
  }

  function handleSnippetClick(snippet: string): void {
    if (disabled) {
      return;
    }

    const currentSelection = readSelection();
    const next = insertSnippet(expression, currentSelection.start, currentSelection.end, snippet);
    updateExpression(next.value);

    if (typeof window === "undefined" || !window.requestAnimationFrame) {
      restoreCursor(next.cursorPosition, next.value);
      return;
    }

    window.requestAnimationFrame(() => restoreCursor(next.cursorPosition, next.value));
  }

  function moveCursor(delta: number): void {
    const currentSelection = readSelection();
    const currentCursor = currentSelection.end;
    const slotCursorPosition = nextSlotCursorPosition(expression, currentCursor, delta);
    restoreCursor(slotCursorPosition ?? Math.max(0, Math.min(expression.length, currentCursor + delta)));
  }

  function deletePreviousCharacter(): void {
    if (disabled) {
      return;
    }

    const currentSelection = readSelection();
    const start = Math.min(currentSelection.start, currentSelection.end);
    const end = Math.max(currentSelection.start, currentSelection.end);

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
      <div className="math-editor">
        <div
          aria-label="Function expression editor"
          aria-readonly={!allowKeyboard}
          className="math-editor-display"
          onClick={() => restoreCursor(cursorPosition)}
          role="textbox"
          tabIndex={0}
        >
          {renderMathPreview(expression, cursorPosition)}
        </div>
        <input
          autoComplete="off"
          className="math-editor-input"
          disabled={disabled}
          id="shot-expression"
          onChange={(event) => {
            updateExpression(event.currentTarget.value);
            updateStoredSelectionFor(
              event.currentTarget.value,
              event.currentTarget.selectionStart ?? event.currentTarget.value.length,
              event.currentTarget.selectionEnd ?? event.currentTarget.value.length
            );
          }}
          onClick={handleInputSelection}
          onKeyUp={handleInputSelection}
          onSelect={handleInputSelection}
          placeholder="sin(x)"
          readOnly={!allowKeyboard}
          ref={inputRef}
          value={expression}
        />
      </div>
      <div className="shot-row">
        <button className="primary-action" data-game-sound="combat.fire" disabled={fireDisabled} type="submit">
          Fire
        </button>
      </div>
      {showKeypad ? (
        <div className="input-button-panel" aria-label="Function keypad">
          <div aria-label="Edit controls" className="cursor-controls" role="group">
            <button
              aria-label="Move cursor left"
              className="snippet-button cursor-button"
              data-game-sound="function.cursor"
              disabled={disabled}
              onClick={() => moveCursor(-1)}
              type="button"
            >
              {"<"}
            </button>
            <button
              aria-label="Move cursor right"
              className="snippet-button cursor-button"
              data-game-sound="function.cursor"
              disabled={disabled}
              onClick={() => moveCursor(1)}
              type="button"
            >
              {">"}
            </button>
            <button
              aria-label="Delete previous character"
              className="snippet-button cursor-button"
              data-game-sound="function.delete"
              disabled={disabled}
              onClick={deletePreviousCharacter}
              type="button"
            >
              Del
            </button>
          </div>
          <section className="button-section">
            <h3>Numbers</h3>
            <div aria-label="Number buttons" className="snippet-palette number-palette" role="group">
              {renderButtonGrid(numberSnippetButtons, disabled, handleSnippetClick)}
            </div>
          </section>
          <section className="button-section">
            <h3>Operations</h3>
            <div aria-label="Operation buttons" className="snippet-palette operation-palette" role="group">
              {renderButtonGrid(operationSnippetButtons, disabled, handleSnippetClick)}
            </div>
          </section>
          <section className="button-section">
            <h3>Functions</h3>
            <div aria-label="Function buttons" className="snippet-palette function-palette" role="group">
              {renderButtonGrid(functionButtons, disabled, handleSnippetClick)}
            </div>
          </section>
        </div>
      ) : null}
    </form>
  );
}
