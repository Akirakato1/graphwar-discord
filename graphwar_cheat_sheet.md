# Graphwar / Graphwar II — Cheat Sheet

Graphwar II is the successor to the original Graphwar and uses the same core "type a function, it becomes your shot" system, wrapped in a modern UI with new modes, campaign, and cosmetics. The mechanics below come from the official Graphwar tutorial/FAQ (the core engine Graphwar II is built on) — where II-specific info couldn't be confirmed, it's marked **[unconfirmed]**.

---

## 1. Core Rules & Field Parameters

| Parameter | Value |
|---|---|
| Field type | Cartesian plane |
| X-axis limits | **-25 to +25** |
| Y-axis limits | **-15 to +15** |
| Team positions | Your team always stands on **negative x** (left of y-axis); enemies on the right |
| Soldier's y-position | NOT zero / NOT the origin — commonly misunderstood |
| Function translation | Whatever you type as `y = f(x)` is auto-shifted to `y = f(x) + c` so it passes through your soldier's exact position |
| "Explode" triggers | (1) function is undefined at that x (e.g. sqrt/log of a negative number, division by ~0), or (2) the function/graph is too long (e.g. very high-frequency sine) and hits a max length limit |
| Angle control | Only affects trajectory in **Second Order Differential Equation mode** (arrow keys change firing angle) |

---

## 2. Allowed Function Components

**Variables**
- `x`
- `y`
- `y'` (used only in differential equation modes)

**Operators**
- `+` `-` `*` `/` `^`

**Built-in functions**
- `sqrt()`
- `log()`
- `ln()`
- `abs()`
- `sin()`, `cos()`, `tan()`
- `exp()`

**Not built in** — must be hand-constructed if you want them:
- Hyperbolic functions (tanh, etc.) — build via `exp()`: `tanh(x) = (exp(x)-exp(-x))/(exp(x)+exp(-x))`

**Syntax gotcha:** the parser resolves loosely — `y = 1/x+2` becomes `(1/x)+2`, NOT `1/(x+2)`. Use explicit parentheses everywhere you mean grouping.

---

## 3. Game Modes (how your typed input becomes a shot)

| Mode | What you type | How trajectory is derived |
|---|---|---|
| **Normal Function** | `y = f(x)` | Graphed directly, then shifted by a constant so it passes through your soldier |
| **1st Order Differential Equation** | `y' = f(x, y)` e.g. `y' = 3*sin(x)+2`, `y' = -y/3`, `y' = 1/(x+y)` | No constant added — your soldier's position is the *initial condition*, and the solved solution curve is the actual shot |
| **2nd Order Differential Equation** | `y'' = f(x, y, y')` e.g. `y'' = -y + y' + 2*x - 1` | Needs **two** initial conditions: soldier position + firing angle (only mode where angle matters) |

**Combo/community techniques (allowed, just clever function-writing):**
- **Piecewise bends via `abs()`:** `a*((x-k)+abs(x-k))` — bends direction at x = k, with slope `a` after the bend. Each such term adds another bend point.
- **"Beam" wall:** add `k*sin(99*x)` to block a lane at height `k`.
- **Step function:** `k/(1+exp(-a*(x+c)))` — `k` = height, `c` = how far flat before stepping, `a` = steepness (use a big value, e.g. 69, for a sharp step).
- **Spike function:** `k/(1+(a*(x-c))^2)` — `k` = height, `1/a` = width, `c` = flat distance before spike.
- **Scaling/transform:** `a*f(b*x+c)` — `a` = vertical scale (negative flips up/down), `b` = horizontal squish/stretch, `c` = horizontal shift.
- **Avoiding explosions on your side:** since your team is at negative x, use `sqrt(abs(x))` instead of `sqrt(x)`, similarly guard `log()`/`ln()` inputs.

---

## 4. Chat Commands (Player Actions)

Typed directly into the in-game chat:

| Command | Effect |
|---|---|
| `-skip` | If **all** players use it, the current map is skipped and a new one generated |
| `-sayfunc` | Shows everyone else's typed functions in your chat |
| `-stopsayfunc` | Turns off `-sayfunc` |
| `-shownext` | Highlights (dark circle) the next soldier to act, per player — useful for planning ahead |
| `-stopshownext` | Turns off `-shownext` |

---

## 5. Lobby Creation / Hosting / Networking

- Multiplayer works peer-to-peer; if friends can't join your lobby, it's almost always your **router blocking incoming connections** — you need to port-forward on your router (method varies by router brand/model).
- The original Graphwar supported **up to 10 players online**, plus the option to play against a computer AI (noted as quite strong).
- **[Unconfirmed]** Graphwar II's exact max lobby size, public-lobby browser behavior, and any host-side rule toggles (map pool, turn timer length, friendly fire, etc.) aren't documented in detail in public sources I could find. Steam tags confirm it supports both local and online multiplayer, turn-based combat, and a single-player campaign, but granular lobby settings aren't spelled out anywhere public.

---

## 6. Turn / Timer Mechanics

- Play is **turn-based** — soldiers take turns firing.
- No official published numbers for turn timer duration, total match timer, or how obstacles/teams are matched are available from official docs I could locate.
- **[Unconfirmed]** If your group wants a house rule (e.g. 30–60 seconds to type a function), that's a common approach players use themselves online since the base game doesn't seem to publish or heavily enforce one.

---

## 7. Known Gaps / Where to Get Exact Answers

Since Graphwar II's lobby/timer/host-controller settings aren't fully documented publicly, your best sources for the missing specifics are:
- The game's **Discord** (linked from its Steam store page)
- In-game host menu — screenshot it and I can decode the exact options with you
- The itch.io comments/devlog for graphwar's page

If you or a friend can grab screenshots of the actual lobby-creation screen or in-match HUD, send them over and I'll fill in the exact parameter names/ranges rather than guessing.
