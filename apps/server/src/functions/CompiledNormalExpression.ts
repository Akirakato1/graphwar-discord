import { Parser } from "expr-eval";
import { normalizeFunctionHitExpression } from "@graphwar/shared";
import { beta, digamma, factorial, gamma, zeta } from "./specialMath";

const maxAggregateDepth = 3;
const maxSumTerms = 1024;
const maxIntegrationPanels = 256;
const panelsPerIntegral = 64;
const maxDerivativeOrder = 4;
const derivativeStep = 1e-3;

const parser = new Parser({
  operators: {
    add: true,
    subtract: true,
    multiply: true,
    divide: true,
    remainder: false,
    power: true,
    factorial: false,
    concatenate: false,
    conditional: false,
    logical: false,
    comparison: false,
    in: false,
    assignment: false
  }
});

parser.functions.gamma = gamma;
parser.functions.factorial = factorial;
parser.functions.digamma = digamma;
parser.functions.beta = beta;
parser.functions.zeta = zeta;
parser.functions.ceiling = Math.ceil;

const normalFunctionSymbols = new Set([
  "abs",
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atan2",
  "atanh",
  "cbrt",
  "ceil",
  "ceiling",
  "cos",
  "cosh",
  "exp",
  "expm1",
  "floor",
  "hypot",
  "log",
  "log1p",
  "log2",
  "log10",
  "max",
  "min",
  "pow",
  "round",
  "sign",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
  "trunc"
]);

const advancedFunctionSymbols = new Set(["beta", "digamma", "factorial", "gamma", "zeta"]);
const baseFunctionSymbols = new Set([...normalFunctionSymbols, ...advancedFunctionSymbols]);
const baseValueSymbols = new Set(["x", "E", "PI"]);
const specialFormSymbols = new Set(["sum", "int", "diff"]);

type EvaluationScope = Record<string, number>;

class EvaluationBudget {
  private sumTerms = 0;
  private integrationPanels = 0;

  useSumTerms(count: number): void {
    this.sumTerms += count;
    if (this.sumTerms > maxSumTerms) {
      throw new Error("Expression exceeded sum evaluation limit");
    }
  }

  useIntegrationPanels(count: number): void {
    this.integrationPanels += count;
    if (this.integrationPanels > maxIntegrationPanels) {
      throw new Error("Expression exceeded integration evaluation limit");
    }
  }
}

export type CompiledNormalExpression = {
  canonicalExpression: string;
  evaluate(scope: EvaluationScope, budget?: EvaluationBudget): number;
};

export type CompileNormalExpressionOptions = {
  advancedFunctions?: boolean;
};

type ExpressionToken = {
  kind: "closeParen" | "identifier" | "number" | "openParen" | "other" | "space";
  text: string;
};

type PlaceholderEvaluator = (scope: EvaluationScope, budget: EvaluationBudget) => number;

export function compileNormalExpression(
  expressionText: string,
  options: CompileNormalExpressionOptions = {}
): CompiledNormalExpression {
  return compileNormalExpressionInternal(expressionText, new Set(baseValueSymbols), 0, options);
}

function compileNormalExpressionInternal(
  expressionText: string,
  valueSymbols: Set<string>,
  aggregateDepth: number,
  options: CompileNormalExpressionOptions
): CompiledNormalExpression {
  assertAdvancedFunctionsAllowed(expressionText, options);
  const placeholders = new Map<string, PlaceholderEvaluator>();
  const rewritten = rewriteSpecialForms(expressionText, valueSymbols, aggregateDepth, placeholders, options);
  const allowedFunctionSymbols = options.advancedFunctions ? baseFunctionSymbols : normalFunctionSymbols;
  const functionSymbols = new Set([...allowedFunctionSymbols, ...placeholders.keys()]);
  const allowedSymbols = new Set([...baseValueSymbols, ...valueSymbols, ...allowedFunctionSymbols, ...placeholders.keys()]);
  const normalizedExpressionText = normalizeImplicitMultiplication(rewritten, valueSymbols, functionSymbols);
  const expression = parser.parse(normalizedExpressionText);
  const invalidSymbol = expression.symbols().find((name) => !allowedSymbols.has(name));
  if (invalidSymbol) {
    throw new Error(`Unsupported symbol "${invalidSymbol}"`);
  }

  return {
    canonicalExpression: normalizeFunctionHitExpression(normalizedExpressionText),
    evaluate(scope, budget = new EvaluationBudget()) {
      const placeholderFunctions: Record<string, () => number> = {};
      for (const [name, evaluatePlaceholder] of placeholders) {
        placeholderFunctions[name] = () => evaluatePlaceholder(scope, budget);
      }
      return expression.evaluate({ ...scope, ...placeholderFunctions });
    }
  };
}

function rewriteSpecialForms(
  expressionText: string,
  valueSymbols: Set<string>,
  aggregateDepth: number,
  placeholders: Map<string, PlaceholderEvaluator>,
  options: CompileNormalExpressionOptions
): string {
  let rewritten = "";
  let index = 0;

  while (index < expressionText.length) {
    const char = expressionText[index];
    if (!/[A-Za-z_]/.test(char)) {
      rewritten += char;
      index += 1;
      continue;
    }

    const identifierStart = index;
    while (index < expressionText.length && /[A-Za-z0-9_]/.test(expressionText[index])) {
      index += 1;
    }

    const identifier = expressionText.slice(identifierStart, index);
    const openParenIndex = skipSpaces(expressionText, index);
    if (!specialFormSymbols.has(identifier) || expressionText[openParenIndex] !== "(") {
      rewritten += identifier;
      continue;
    }

    if (aggregateDepth >= maxAggregateDepth) {
      throw new Error("Expression exceeded aggregate nesting limit");
    }

    const closeParenIndex = findMatchingParen(expressionText, openParenIndex);
    const args = splitTopLevelArguments(expressionText.slice(openParenIndex + 1, closeParenIndex));
    const placeholderName = `__normal_special_${placeholders.size}`;
    placeholders.set(placeholderName, compileSpecialForm(identifier, args, valueSymbols, aggregateDepth + 1, options));
    rewritten += `${placeholderName}()`;
    index = closeParenIndex + 1;
  }

  return rewritten;
}

function compileSpecialForm(
  name: string,
  args: string[],
  valueSymbols: Set<string>,
  aggregateDepth: number,
  options: CompileNormalExpressionOptions
): PlaceholderEvaluator {
  if (name === "sum") {
    return compileSum(args, valueSymbols, aggregateDepth, options);
  }
  if (name === "int") {
    return compileIntegral(args, valueSymbols, aggregateDepth, options);
  }
  return compileDerivative(args, valueSymbols, aggregateDepth, options);
}

function compileSum(
  args: string[],
  valueSymbols: Set<string>,
  aggregateDepth: number,
  options: CompileNormalExpressionOptions
): PlaceholderEvaluator {
  if (args.length !== 4) {
    throw new Error("sum(index, lower, upper, body) requires four arguments");
  }

  const indexName = requireIdentifier(args[0], "sum index");
  const lower = compileNormalExpressionInternal(args[1], valueSymbols, aggregateDepth, options);
  const upper = compileNormalExpressionInternal(args[2], valueSymbols, aggregateDepth, options);
  const bodyValueSymbols = new Set([...valueSymbols, indexName]);
  const body = compileNormalExpressionInternal(args[3], bodyValueSymbols, aggregateDepth, options);

  return (scope, budget) => {
    const first = Math.ceil(evaluateFinite(lower, scope, budget));
    const last = Math.floor(evaluateFinite(upper, scope, budget));
    const termCount = Math.max(0, last - first + 1);
    budget.useSumTerms(termCount);

    let total = 0;
    for (let value = first; value <= last; value += 1) {
      total += evaluateFinite(body, { ...scope, [indexName]: value }, budget);
    }
    return total;
  };
}

function compileIntegral(
  args: string[],
  valueSymbols: Set<string>,
  aggregateDepth: number,
  options: CompileNormalExpressionOptions
): PlaceholderEvaluator {
  if (args.length !== 4) {
    throw new Error("int(variable, lower, upper, body) requires four arguments");
  }

  const variableName = requireIdentifier(args[0], "integration variable");
  const lower = compileNormalExpressionInternal(args[1], valueSymbols, aggregateDepth, options);
  const upper = compileNormalExpressionInternal(args[2], valueSymbols, aggregateDepth, options);
  const bodyValueSymbols = new Set([...valueSymbols, variableName]);
  const body = compileNormalExpressionInternal(args[3], bodyValueSymbols, aggregateDepth, options);

  return (scope, budget) =>
    integrate(
      variableName,
      evaluateFinite(lower, scope, budget),
      evaluateFinite(upper, scope, budget),
      body,
      scope,
      budget
    );
}

function compileDerivative(
  args: string[],
  valueSymbols: Set<string>,
  aggregateDepth: number,
  options: CompileNormalExpressionOptions
): PlaceholderEvaluator {
  if (args.length !== 3) {
    throw new Error("diff(variable, order, body) requires three arguments");
  }

  const variableName = requireIdentifier(args[0], "derivative variable");
  if (variableName !== "x") {
    throw new Error("diff only supports x as the derivative variable");
  }

  const orderExpression = compileNormalExpressionInternal(args[1], valueSymbols, aggregateDepth, options);
  const body = compileNormalExpressionInternal(args[2], valueSymbols, aggregateDepth, options);

  return (scope, budget) => {
    const order = evaluateFinite(orderExpression, scope, budget);
    if (!Number.isInteger(order) || order < 0 || order > maxDerivativeOrder) {
      throw new Error(`Derivative order must be an integer from 0 to ${maxDerivativeOrder}`);
    }
    return evaluateDerivative(body, scope, budget, order);
  };
}

function evaluateDerivative(
  body: CompiledNormalExpression,
  scope: EvaluationScope,
  budget: EvaluationBudget,
  order: number
): number {
  if (order === 0) {
    return evaluateFinite(body, scope, budget);
  }

  const x = scope.x;
  const forward = evaluateDerivative(body, { ...scope, x: x + derivativeStep }, budget, order - 1);
  const backward = evaluateDerivative(body, { ...scope, x: x - derivativeStep }, budget, order - 1);
  return (forward - backward) / (2 * derivativeStep);
}

function integrate(
  variable: string,
  lower: number,
  upper: number,
  body: CompiledNormalExpression,
  scope: EvaluationScope,
  budget: EvaluationBudget
): number {
  if (lower === upper) {
    return 0;
  }

  budget.useIntegrationPanels(panelsPerIntegral);

  const sign = lower <= upper ? 1 : -1;
  const a = lower <= upper ? lower : upper;
  const b = lower <= upper ? upper : lower;
  const h = (b - a) / panelsPerIntegral;
  let weighted = 0;

  for (let index = 0; index <= panelsPerIntegral; index += 1) {
    const weight = index === 0 || index === panelsPerIntegral ? 1 : index % 2 === 0 ? 2 : 4;
    weighted += weight * evaluateFinite(body, { ...scope, [variable]: a + index * h }, budget);
  }

  return sign * (h / 3) * weighted;
}

function evaluateFinite(
  expression: CompiledNormalExpression,
  scope: EvaluationScope,
  budget: EvaluationBudget
): number {
  const value = expression.evaluate(scope, budget);
  if (!Number.isFinite(value)) {
    throw new Error("Function must evaluate to a finite number");
  }
  return value;
}

function assertAdvancedFunctionsAllowed(
  expressionText: string,
  options: CompileNormalExpressionOptions
): void {
  if (options.advancedFunctions) {
    return;
  }

  const tokens = tokenizeExpression(expressionText);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (
      token.kind !== "identifier" ||
      (!advancedFunctionSymbols.has(token.text) && !specialFormSymbols.has(token.text))
    ) {
      continue;
    }

    let nextIndex = index + 1;
    while (tokens[nextIndex]?.kind === "space") {
      nextIndex += 1;
    }

    if (tokens[nextIndex]?.kind === "openParen") {
      throw new Error("Advanced functions are disabled for this lobby.");
    }
  }
}

function normalizeImplicitMultiplication(
  expressionText: string,
  valueSymbols: Set<string>,
  functionSymbols: Set<string>
): string {
  const tokens = tokenizeExpression(expressionText);
  let normalized = "";
  let previousSignificant: ExpressionToken | undefined;

  for (const token of tokens) {
    if (token.kind === "space") {
      normalized += token.text;
      continue;
    }

    if (previousSignificant && shouldInsertMultiply(previousSignificant, token, valueSymbols, functionSymbols)) {
      normalized += "*";
    }

    normalized += token.text;
    previousSignificant = token;
  }

  return normalized;
}

function tokenizeExpression(expressionText: string): ExpressionToken[] {
  const tokens: ExpressionToken[] = [];
  let index = 0;

  while (index < expressionText.length) {
    const char = expressionText[index];

    if (/\s/.test(char)) {
      const start = index;
      while (index < expressionText.length && /\s/.test(expressionText[index])) {
        index += 1;
      }
      tokens.push({ kind: "space", text: expressionText.slice(start, index) });
      continue;
    }

    if (char === "(") {
      tokens.push({ kind: "openParen", text: char });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ kind: "closeParen", text: char });
      index += 1;
      continue;
    }

    if (isNumberStart(expressionText, index)) {
      const result = readNumber(expressionText, index);
      tokens.push({ kind: "number", text: result.text });
      index = result.nextIndex;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      while (index < expressionText.length && /[A-Za-z0-9_]/.test(expressionText[index])) {
        index += 1;
      }
      tokens.push({ kind: "identifier", text: expressionText.slice(start, index) });
      continue;
    }

    tokens.push({ kind: "other", text: char });
    index += 1;
  }

  return tokens;
}

function isNumberStart(expressionText: string, index: number): boolean {
  const char = expressionText[index];
  const next = expressionText[index + 1];
  return /\d/.test(char) || (char === "." && typeof next === "string" && /\d/.test(next));
}

function readNumber(expressionText: string, start: number): { nextIndex: number; text: string } {
  let index = start;

  while (index < expressionText.length && /\d/.test(expressionText[index])) {
    index += 1;
  }

  if (expressionText[index] === ".") {
    index += 1;
    while (index < expressionText.length && /\d/.test(expressionText[index])) {
      index += 1;
    }
  }

  if (expressionText[index] === "e" || expressionText[index] === "E") {
    const exponentStart = index;
    index += 1;
    if (expressionText[index] === "+" || expressionText[index] === "-") {
      index += 1;
    }

    const digitStart = index;
    while (index < expressionText.length && /\d/.test(expressionText[index])) {
      index += 1;
    }

    if (digitStart === index) {
      index = exponentStart;
    }
  }

  return { nextIndex: index, text: expressionText.slice(start, index) };
}

function shouldInsertMultiply(
  previous: ExpressionToken,
  next: ExpressionToken,
  valueSymbols: Set<string>,
  functionSymbols: Set<string>
): boolean {
  if (!canEndFactor(previous) || !canStartFactor(next)) {
    return false;
  }

  if (previous.kind === "identifier" && functionSymbols.has(previous.text)) {
    return false;
  }

  if (previous.kind === "identifier" && next.kind === "openParen" && !valueSymbols.has(previous.text)) {
    return false;
  }

  return true;
}

function canEndFactor(token: ExpressionToken): boolean {
  return token.kind === "closeParen" || token.kind === "identifier" || token.kind === "number";
}

function canStartFactor(token: ExpressionToken): boolean {
  return token.kind === "identifier" || token.kind === "number" || token.kind === "openParen";
}

function skipSpaces(text: string, index: number): number {
  let nextIndex = index;
  while (nextIndex < text.length && /\s/.test(text[nextIndex])) {
    nextIndex += 1;
  }
  return nextIndex;
}

function findMatchingParen(text: string, openParenIndex: number): number {
  let depth = 0;
  for (let index = openParenIndex; index < text.length; index += 1) {
    if (text[index] === "(") {
      depth += 1;
    } else if (text[index] === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error("Unmatched opening parenthesis");
}

function splitTopLevelArguments(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth < 0) {
        throw new Error("Unmatched closing parenthesis");
      }
    } else if (char === "," && depth === 0) {
      args.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (depth !== 0) {
    throw new Error("Unmatched opening parenthesis");
  }

  args.push(text.slice(start).trim());
  return args;
}

function requireIdentifier(text: string, label: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) {
    throw new Error(`${label} must be an identifier`);
  }
  return text;
}
