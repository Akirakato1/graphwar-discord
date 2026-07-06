# Advanced Normal Function Math Design

## Goal

Extend normal-function shots with aggregate, calculus, and special-function helpers while keeping the game controller and shot simulation independent of specific function families.

## Requirements

- Keep player-entered syntax ASCII and mobile-friendly.
- Render palette labels with mathematical symbols where useful, while inserting parser-safe text.
- Allow `x` anywhere inside aggregate bounds and aggregate bodies.
- Support numeric summation with `sum(index, lower, upper, body)`.
- Support numeric integration with `int(variable, lower, upper, body)`.
- Support finite-difference derivatives with `diff(variable, order, body)`.
- Support `gamma`, `factorial`, `digamma`, and `beta`.
- Support `floor`, `ceil`, and `ceiling` palette entries.
- Preserve existing implicit multiplication and unary negative behavior.
- Reject expressions that are non-finite, too deeply nested, or too expensive to evaluate.

## Syntax

Players type or insert function-call forms:

```txt
sum(n, 0, x, n^2)
int(t, 0, x, sin(t*x))
int(t, 0, 1, 1 / sqrt(1 - 0.5^2 * sin(t)^2))
diff(x, 2, sin(x))
gamma(x)
factorial(x)
digamma(x)
beta(x, 2)
floor(x)
ceil(x)
ceiling(x)
```

The outer sampled coordinate `x` is in scope for lower bounds, upper bounds, and body expressions. Bound variables such as `n` and `t` are local to their aggregate body and shadow only within that aggregate.

## Semantics

`sum(index, lower, upper, body)` evaluates the bounds at the current sampled `x`, then iterates integer `index` from `ceil(lower)` through `floor(upper)`. Empty sums return `0`. Non-finite bounds, body values, or sums reject the shot.

`int(variable, lower, upper, body)` evaluates both bounds at the current sampled `x`, then numerically integrates the body over that interval with a fixed-panel composite Simpson rule. The body may also refer to the sampled `x`, so `int(t, 0, x, sin(t*x))` is valid. Reversed bounds return the negative integral.

`diff(variable, order, body)` evaluates a finite-difference derivative. For the first implementation, the supported variable is `x`, because normal-function shots are sampled as `f(x)`. Higher orders are supported up to order `4`.

`factorial(value)` is implemented as `gamma(value + 1)`, so it can be used continuously. The existing expression still must evaluate to a finite number at `x = 0` before the shot is accepted.

## Architecture

Add a small expression compiler around the existing `expr-eval` parser in `NormalFunction`. The compiler identifies special forms (`sum`, `int`, `diff`) at parse time, compiles their child expressions recursively, and exposes generated numeric placeholders to the existing parser. Plain functions such as `gamma`, `factorial`, `digamma`, `beta`, `floor`, `ceil`, and `ceiling` are registered as allowed deterministic helpers.

This keeps the public `ShotFunction` interface unchanged. `NormalFunction.parse()` still returns an object with `sample()`, and the game controller still receives only sampled trajectories.

## Guardrails

- Cap aggregate nesting depth to `3`.
- Cap total sum terms per sampled expression evaluation to `1024`.
- Cap total integration panels per sampled expression evaluation to `256`.
- Use `64` Simpson panels per integral before the total-panel cap is applied.
- Cap derivative order to `4`.
- Reject non-finite intermediate and final values.
- Preserve the existing `maxPathPoints` and traveled-path-length limits.
- Treat guardrail failures as invalid or undefined functions, matching existing shot rejection/explosion behavior.

## Client Palette

The client palette remains a compact set of buttons inside the existing function input. Buttons display mathematical labels such as summation, integral, derivative, gamma, factorial, digamma, beta, floor, and ceiling symbols where appropriate, and insert ASCII snippets such as `sum(n,0,x,)`, `int(t,0,x,)`, `diff(x,1,)`, `gamma()`, and `ceil()`.

Cursor placement follows the existing snippet insertion helper. The palette is only an editing helper; the server remains authoritative over parsing, validation, and evaluation.

## Testing

- Parser tests cover `x` in bounds and bodies for `sum` and `int`.
- Parser tests cover implicit multiplication with new helpers, including parenthesized negatives.
- Parser tests cover `gamma`, `factorial`, `digamma`, `beta`, `floor`, `ceil`, and `ceiling`.
- Parser tests cover guardrail rejection for excessive sums, excessive integration work, high derivative order, unsupported variables, and non-finite results.
- Client tests cover rendered mathematical palette labels and inserted ASCII snippets.
- Existing shot simulation tests continue to prove controller and trajectory behavior remain unchanged.

## Out Of Scope

- Dot product, cross product, convolution, and vector-valued expressions.
- Unicode math input parsing.
- Symbolic simplification or closed-form calculus.
- New shot function families beyond normal functions.
