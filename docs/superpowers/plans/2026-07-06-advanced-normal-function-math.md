# Advanced Normal Function Math Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add advanced normal-function math helpers for summation, numeric integration, finite-difference derivatives, gamma-family functions, and compact mathematical palette buttons.

**Architecture:** Keep `ShotFunction`, `ShotSimulator`, and match controllers unchanged. Add a server-side expression compiler that wraps `expr-eval`, expands lazy special forms into generated numeric placeholders, and registers deterministic special functions. Keep the client palette as an editing helper that renders math labels but inserts ASCII snippets.

**Tech Stack:** TypeScript, Vitest, React, `expr-eval`, existing snippet insertion helper.

---

## File Structure

- Modify `apps/server/src/functions/NormalFunction.ts`: wire normal-function parsing through the advanced compiler while preserving sampling behavior and implicit multiplication.
- Create `apps/server/src/functions/CompiledNormalExpression.ts`: compile and evaluate expressions with `sum`, `int`, and `diff` special forms plus evaluation budgets.
- Create `apps/server/src/functions/specialMath.ts`: deterministic `gamma`, `logGamma`, `factorial`, `digamma`, and `beta` helpers.
- Modify `apps/server/src/functions/NormalFunction.test.ts`: add parser/evaluator behavior tests for aggregates, special functions, implicit multiplication, and guardrails.
- Modify `apps/client/src/input/FunctionInput.tsx`: add compact rendered math palette buttons that insert ASCII snippets.
- Modify `apps/client/src/input/FunctionInput.test.ts`: cover the new labels and snippets.
- Modify `README.md`: document the user-facing advanced math syntax and update the checkpoint log.

## Constants And Rules

- Aggregate nesting cap: `3`.
- Sum term cap per sampled expression evaluation: `1024`.
- Integration panel cap per sampled expression evaluation: `256`.
- Simpson panels per `int(...)`: `64`.
- Derivative order cap: `4`.
- `sum(index, lower, upper, body)` iterates `ceil(lower)` through `floor(upper)`.
- `int(variable, lower, upper, body)` supports `x` in both bounds and body and uses reversed-bound sign.
- `diff(variable, order, body)` supports `variable = x` only in this implementation.
- `factorial(value)` is `gamma(value + 1)`.
- `ceil` and `ceiling` are aliases.

---

### Task 1: Server Tests For Advanced Math

**Files:**
- Modify: `apps/server/src/functions/NormalFunction.test.ts`

- [ ] **Step 1: Add failing aggregate and special-function tests**

Append these tests inside the existing `describe("NormalFunction", () => { ... })` block:

```ts
  it("evaluates sums with sampled x in bounds and body", () => {
    const shot = NormalFunction.parse("sum(n, 0, x, n*cos(x))");
    const sample = shot.sample({ minX: 0, maxX: 2, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points[0]).toEqual({ x: 0, y: 0 });
      expect(sample.points[1]?.y).toBeCloseTo(Math.cos(1));
      expect(sample.points[2]?.y).toBeCloseTo(3 * Math.cos(2));
    }
  });

  it("evaluates numeric integrals with sampled x in bounds and integrand", () => {
    const shot = NormalFunction.parse("int(t, 0, x, t*x)");
    const sample = shot.sample({ minX: 0, maxX: 2, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points[0]).toEqual({ x: 0, y: 0 });
      expect(sample.points[1]?.y).toBeCloseTo(0.5, 5);
      expect(sample.points[2]?.y).toBeCloseTo(4, 5);
    }
  });

  it("evaluates finite-difference derivatives with respect to x", () => {
    const shot = NormalFunction.parse("diff(x, 2, x^3)");
    const sample = shot.sample({ minX: 0, maxX: 2, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points[0]).toEqual({ x: 0, y: 0 });
      expect(sample.points[1]?.y).toBeCloseTo(6, 2);
      expect(sample.points[2]?.y).toBeCloseTo(12, 2);
    }
  });

  it("evaluates gamma-family helpers and continuous factorial", () => {
    const factorialShot = NormalFunction.parse("factorial(x)");
    const digammaShot = NormalFunction.parse("digamma(x + 1)");
    const betaShot = NormalFunction.parse("beta(x + 1, 2)");
    const factorialSample = factorialShot.sample({ minX: 0, maxX: 3, step: 1, maxPathPoints: 10 });
    const digammaSample = digammaShot.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });
    const betaSample = betaShot.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });

    expect(factorialSample.ok).toBe(true);
    expect(digammaSample.ok).toBe(true);
    expect(betaSample.ok).toBe(true);
    if (factorialSample.ok && digammaSample.ok && betaSample.ok) {
      expect(factorialSample.points[3]?.y).toBeCloseTo(5);
      expect(digammaSample.points[1]?.y).toBeCloseTo(1, 5);
      expect(betaSample.points[1]?.y).toBeCloseTo(-1 / 3, 5);
    }
  });
```

- [ ] **Step 2: Add failing implicit multiplication and guardrail tests**

Append these tests after the tests from Step 1:

```ts
  it("preserves implicit multiplication and unary negatives with advanced helpers", () => {
    const shot = NormalFunction.parse("3gamma(x + 1) + cos(x)(-sin(x))");
    const sample = shot.sample({ minX: 0, maxX: 2, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points[0]).toEqual({ x: 0, y: 0 });
      expect(sample.points[2]?.y).toBeCloseTo(3 - Math.cos(2) * Math.sin(2));
    }
  });

  it("evaluates floor and ceiling aliases", () => {
    const shot = NormalFunction.parse("floor(x + 0.75) + ceil(x - 0.25) + ceiling(x - 0.25)");
    const sample = shot.sample({ minX: 0, maxX: 1, step: 1, maxPathPoints: 10 });

    expect(sample.ok).toBe(true);
    if (sample.ok) {
      expect(sample.points).toEqual([{ x: 0, y: 0 }, { x: 1, y: 3 }]);
    }
  });

  it("rejects excessive aggregate and derivative work", () => {
    expect(() => NormalFunction.parse("sum(n, 0, 2000, n)")).toThrow(/evaluation limit/i);
    expect(() => NormalFunction.parse("diff(x, 5, sin(x))")).toThrow(/derivative order/i);
    expect(() => NormalFunction.parse("diff(t, 1, sin(t))")).toThrow(/only supports x/i);
  });
```

- [ ] **Step 3: Run the targeted tests and verify they fail for missing support**

Run:

```bash
npm test -- apps/server/src/functions/NormalFunction.test.ts
```

Expected: FAIL because `sum`, `int`, `diff`, `gamma`, `factorial`, `digamma`, `beta`, or `ceiling` are unsupported.

---

### Task 2: Special Math Helpers

**Files:**
- Create: `apps/server/src/functions/specialMath.ts`

- [ ] **Step 1: Create deterministic special math helpers**

Create `apps/server/src/functions/specialMath.ts`:

```ts
const lanczosCoefficients = [
  676.5203681218851,
  -1259.1392167224028,
  771.3234287776531,
  -176.6150291621406,
  12.507343278686905,
  -0.13857109526572012,
  9.984369578019572e-6,
  1.5056327351493116e-7
];

const halfLogTwoPi = 0.9189385332046727;

function assertFinite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Function must evaluate to a finite number");
  }
  return value;
}

export function logGamma(value: number): number {
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }

  const z = value - 1;
  let x = 0.9999999999998099;
  for (let index = 0; index < lanczosCoefficients.length; index += 1) {
    x += lanczosCoefficients[index] / (z + index + 1);
  }

  const t = z + lanczosCoefficients.length - 0.5;
  return assertFinite(halfLogTwoPi + (z + 0.5) * Math.log(t) - t + Math.log(x));
}

export function gamma(value: number): number {
  return assertFinite(Math.exp(logGamma(value)));
}

export function factorial(value: number): number {
  return gamma(value + 1);
}

export function beta(a: number, b: number): number {
  return assertFinite(Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b)));
}

export function digamma(value: number): number {
  let x = value;
  let result = 0;

  while (x < 8) {
    result -= 1 / x;
    x += 1;
  }

  const inverse = 1 / x;
  const inverseSquared = inverse * inverse;
  result += Math.log(x) - 0.5 * inverse - inverseSquared / 12 + inverseSquared * inverseSquared / 120;
  return assertFinite(result);
}
```

- [ ] **Step 2: Run the targeted tests and verify they still fail on parser wiring**

Run:

```bash
npm test -- apps/server/src/functions/NormalFunction.test.ts
```

Expected: FAIL because helpers exist but are not yet registered with normal-function parsing.

---

### Task 3: Advanced Expression Compiler

**Files:**
- Create: `apps/server/src/functions/CompiledNormalExpression.ts`
- Modify: `apps/server/src/functions/NormalFunction.ts`

- [ ] **Step 1: Move parser setup and implicit multiplication support into compiler**

Create `apps/server/src/functions/CompiledNormalExpression.ts` with the parser setup, tokenizer, and implicit-multiplication helpers currently in `NormalFunction.ts`. Add configurable value symbols:

```ts
import { Parser } from "expr-eval";
import { beta, digamma, factorial, gamma } from "./specialMath";

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
parser.functions.ceiling = Math.ceil;

const baseFunctionSymbols = new Set([
  "abs", "acos", "acosh", "asin", "asinh", "atan", "atan2", "atanh",
  "beta", "cbrt", "ceil", "ceiling", "cos", "cosh", "digamma", "exp",
  "expm1", "factorial", "floor", "gamma", "hypot", "log", "log1p",
  "log2", "log10", "max", "min", "pow", "round", "sign", "sin",
  "sinh", "sqrt", "tan", "tanh", "trunc"
]);

const baseValueSymbols = new Set(["x", "E", "PI"]);
const specialFormSymbols = new Set(["sum", "int", "diff"]);
```

The tokenizer should match the current `NormalFunction.ts` logic, but `normalizeImplicitMultiplication(expressionText, valueSymbols)` should treat any symbol in `valueSymbols` as a non-function value so `n(x + 1)` normalizes to `n*(x + 1)` inside a summation body.

- [ ] **Step 2: Add evaluation budget and compiled expression types**

Add this near the top of `CompiledNormalExpression.ts`:

```ts
const maxAggregateDepth = 3;
const maxSumTerms = 1024;
const maxIntegrationPanels = 256;
const panelsPerIntegral = 64;
const maxDerivativeOrder = 4;
const derivativeStep = 1e-3;

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
  evaluate(scope: EvaluationScope, budget?: EvaluationBudget): number;
};
```

- [ ] **Step 3: Add special-form parsing helpers**

Add helpers that scan for `sum(...)`, `int(...)`, and `diff(...)`, split top-level arguments, and reject malformed forms:

```ts
function splitTopLevelArguments(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      args.push(text.slice(start, index).trim());
      start = index + 1;
    }
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
```

The scanner must preserve other text unchanged and recursively call `compileNormalExpressionInternal` for each bound, body, and derivative body.

- [ ] **Step 4: Add aggregate evaluators**

Implement `compileSum`, `compileIntegral`, and `compileDerivative`:

```ts
function evaluateFinite(expression: CompiledNormalExpression, scope: EvaluationScope, budget: EvaluationBudget): number {
  const value = expression.evaluate(scope, budget);
  if (!Number.isFinite(value)) {
    throw new Error("Function must evaluate to a finite number");
  }
  return value;
}

function integrate(
  variable: string,
  lower: number,
  upper: number,
  body: CompiledNormalExpression,
  scope: EvaluationScope,
  budget: EvaluationBudget
): number {
  if (lower === upper) return 0;
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
```

For derivatives, evaluate recursively with central differences and reject orders outside `0..4` and variables other than `x`.

- [ ] **Step 5: Export the compiler and update `NormalFunction.ts`**

Export:

```ts
export function compileNormalExpression(expressionText: string): CompiledNormalExpression {
  return compileNormalExpressionInternal(expressionText, new Set(baseValueSymbols), 0);
}
```

Then simplify `NormalFunction.parse()` to:

```ts
const compiledExpression = compileNormalExpression(expressionText.replace(/^y\s*=\s*/i, ""));
const evaluateExpression = (x: number) => compiledExpression.evaluate({ x });
```

Remove duplicated parser setup and tokenizer code from `NormalFunction.ts` after the compiler owns it.

- [ ] **Step 6: Run the targeted tests and verify they pass**

Run:

```bash
npm test -- apps/server/src/functions/NormalFunction.test.ts
```

Expected: PASS.

---

### Task 4: Client Math Palette

**Files:**
- Modify: `apps/client/src/input/FunctionInput.tsx`
- Modify: `apps/client/src/input/FunctionInput.test.ts`

- [ ] **Step 1: Add failing palette rendering tests**

Extend the first `FunctionInput` test with expectations:

```ts
    expect(html).toContain("aria-label=\"Insert summation template\"");
    expect(html).toContain(">Σ<");
    expect(html).toContain("aria-label=\"Insert integral template\"");
    expect(html).toContain(">∫<");
    expect(html).toContain("aria-label=\"Insert second derivative template\"");
    expect(html).toContain("D<sub>x</sub><sup>2</sup>");
    expect(html).toContain(">Γ<");
    expect(html).toContain(">ψ<");
    expect(html).toContain(">Β<");
    expect(html).toContain(">⌊x⌋<");
    expect(html).toContain(">⌈x⌉<");
```

- [ ] **Step 2: Run the client input tests and verify they fail**

Run:

```bash
npm test -- apps/client/src/input
```

Expected: FAIL because the new palette entries are not rendered yet.

- [ ] **Step 3: Add label markup support and advanced snippets**

Update `SnippetButton` and the render loop in `FunctionInput.tsx`:

```tsx
type SnippetButton = {
  label: React.ReactNode;
  snippet: string;
  ariaLabel: string;
};
```

Add compact snippets:

```tsx
  { label: "Σ", snippet: "sum(n,0,x,)", ariaLabel: "Insert summation template" },
  { label: "∫", snippet: "int(t,0,x,)", ariaLabel: "Insert integral template" },
  { label: <>D<sub>x</sub><sup>2</sup></>, snippet: "diff(x,2,)", ariaLabel: "Insert second derivative template" },
  { label: "Γ", snippet: "gamma()", ariaLabel: "Insert gamma function" },
  { label: "!", snippet: "factorial()", ariaLabel: "Insert continuous factorial function" },
  { label: "ψ", snippet: "digamma()", ariaLabel: "Insert digamma function" },
  { label: "Β", snippet: "beta(,)", ariaLabel: "Insert beta function" },
  { label: "⌊x⌋", snippet: "floor()", ariaLabel: "Insert floor function" },
  { label: "⌈x⌉", snippet: "ceil()", ariaLabel: "Insert ceiling function" }
```

Keep the existing disabled behavior unchanged.

- [ ] **Step 4: Run the client input tests and verify they pass**

Run:

```bash
npm test -- apps/client/src/input
```

Expected: PASS.

---

### Task 5: README And Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document advanced normal-function syntax**

Add a short paragraph after the existing normal-function input examples:

```md
Advanced normal-function input also accepts aggregate and special-function helpers. Examples include `sum(n,0,x,n*cos(x))`, `int(t,0,x,sin(t*x))`, `diff(x,2,sin(x))`, `gamma(x)`, `factorial(x)`, `digamma(x)`, `beta(x,2)`, `floor(x)`, `ceil(x)`, and `ceiling(x)`. The sampled local `x` is available inside summation/integration bounds and bodies. These helpers are evaluated numerically on the server with fixed safety caps.
```

Add a checkpoint log line:

```md
- Added advanced normal-function math helpers for server-authoritative summation, numeric integration, finite-difference derivatives, gamma-family functions, floor/ceiling aliases, and mathematical palette snippets.
```

- [ ] **Step 2: Run targeted verification**

Run:

```bash
npm test -- apps/server/src/functions/NormalFunction.test.ts
npm test -- apps/client/src/input
npm run check
npm test
```

Expected: all commands exit `0`.

- [ ] **Step 3: Commit and push implementation checkpoint**

Run:

```bash
git add apps/server/src/functions/NormalFunction.ts apps/server/src/functions/NormalFunction.test.ts apps/server/src/functions/CompiledNormalExpression.ts apps/server/src/functions/specialMath.ts apps/client/src/input/FunctionInput.tsx apps/client/src/input/FunctionInput.test.ts README.md
git commit -m "feat: add advanced normal function math"
git push
```

Expected: commit succeeds without `Co-Authored-By` trailers and push updates `origin/feature/graphwar-prototype`.

---

## Self-Review

- Spec coverage: summation, integration, derivative, special functions, floor/ceiling, ASCII syntax, mathematical palette labels, implicit multiplication, guardrails, and unchanged controller boundaries are covered.
- Placeholder scan: this plan contains no `TBD`, `TODO`, or deferred implementation steps.
- Type consistency: the compiler exports `compileNormalExpression()` and `CompiledNormalExpression`; `NormalFunction.parse()` consumes only `evaluate({ x })`.
