# Gameplay Settings Phase 2 Design

## Goal

Add server-authoritative lobby settings for player-hit damage, unique successful function hits, and friendly fire. These settings should affect match simulation without changing how clients decide outcomes.

## Scope

This is Phase 2 of the gameplay-settings request. It builds on the existing lobby settings path used by `maxFunctionLength`. It does not include Phase 1 map sizing, camera controls, avatar rendering, or Discord SDK integration.

## Requirements

- Lobby creators can choose direct player-hit damage from `35` to `100`.
- Damage defaults to `35`, preserving current gameplay.
- Damage is server-authoritative and applies only when a shot resolves as `player-hit`.
- A hit can reduce HP below the configured damage amount but never below `0`.
- `100` damage is one-shot elimination against the current `100` HP player baseline.
- `Unique function hits` is a lobby toggle, defaulting to `true`.
- When enabled, a player cannot successfully hit the same target twice with the same normalized function shot.
- The unique-hit rule only records successful player hits.
- Terrain hits, misses, field-boundary hits, path-too-long fizzles, invalid functions, and rejected shots do not create unique-hit records.
- A unique-hit rejection happens before state is committed and does not consume the turn.
- The unique-hit identity includes shooter id, target id, function family, normalized expression, and aim direction.
- The normalized expression should be stable for cosmetic whitespace differences.
- `Friendly fire` is a lobby toggle for team-versus matches, defaulting to `false`.
- When friendly fire is off, shots cannot collide with living teammates.
- When friendly fire is on, teammates are valid player-hit targets.
- Friendly fire has no effect in free-for-all mode.
- These settings are visible in lobby setup snapshots so all clients see the active rules before the match starts.

## Architecture

Add a shared gameplay settings contract that lives beside the existing lobby identity and max-function-length settings:

```txt
LobbyGameplaySettings
  damagePerHit: number
  uniqueFunctionHits: boolean
  friendlyFire: boolean
```

The shared package owns bounds, defaults, normalization helpers, and Zod schemas. `CreateLobbyRequest`, `LobbyRuntimeSnapshot`, and lobby summaries carry the settings. `LobbyDirectory` stores normalized settings on runtime lobbies. `GameRoom` passes the settings into `MatchController.startMatch()` with `maxFunctionLength`.

`MatchController` owns match-level rule memory because it already validates turn ownership, creates the function instance, calls simulation, advances turns, and emits shot events. It stores:

```txt
MatchRules
  damagePerHit
  uniqueFunctionHits
  friendlyFire

successfulHitKeys: Set<string>
```

`ShotSimulator` remains responsible for sampling, collision, terrain mutation, and damage application. It receives simulation options for `damagePerHit` and `allowFriendlyFire`, then returns the same shape of `ShotSimulationResult` with configured damage values.

## Data Flow

1. Create Lobby form submits `damagePerHit`, `uniqueFunctionHits`, and `friendlyFire`.
2. Shared schemas validate and normalize the values.
3. `LobbyDirectory` stores settings and includes them in lobby snapshots.
4. Lobby setup displays the settings as read-only match rules after creation.
5. Start Match passes settings from the lobby snapshot to `MatchController.startMatch()`.
6. `MatchController` stores `MatchRules` and resets `successfulHitKeys`.
7. On each shot, `MatchController` tentatively simulates the result, then checks unique-hit history before committing a result.
8. `ShotSimulator` applies configured damage and friendly-fire target filtering.
9. If a player hit succeeds, `MatchController` records the unique-hit key after the result is accepted.
10. Events and snapshots broadcast the same authoritative HP, damage, elimination, and turn state clients already render.

## Unique Function Hits

The first implementation should use a simple canonical shot key:

```txt
<shooterId>|<targetId>|<familyId>|<aimDirection>|<normalizedExpression>
```

`normalizedExpression` removes ASCII whitespace from the entered expression. This handles common duplicate entries such as `sin(x)` and `sin( x )`. Algebraic equivalence, such as `sin(x)` versus `1*sin(x)`, is intentionally out of scope.

Because the target is needed for the key, the controller has to simulate a tentative result first, inspect `impact.targetPlayerId`, and then decide whether the result is allowed. If the key already exists, the controller rejects the shot and leaves snapshot state unchanged. If the key is new, it commits the result, advances the turn, and records the key.

The rejection message should be direct:

```txt
That function already hit this target. Try a different function.
```

## Friendly Fire

Friendly-fire filtering belongs in player target selection. The simulator should receive `allowFriendlyFire` and ignore teammates when:

- the match mode is `team-versus`;
- `allowFriendlyFire` is `false`;
- the candidate player has the same non-empty `teamId` as the shooter.

Free-for-all matches always treat every non-shooter living player as a valid target.

If a teammate is ignored, the path can continue past them and still hit terrain, an enemy, the field boundary, or the range limit later. Ignored teammates do not block the function path.

## Damage

Direct-hit damage is no longer read from `defaultMatchTuning.directHitDamage` inside simulation. The default tuning value remains the default for the new lobby setting. `ShotSimulator` receives a normalized `damagePerHit` option and uses it for:

- the `damage[].amount` event value;
- the target `hpAfter`;
- elimination checks.

Terrain crater radius and terrain destruction are unchanged. The damage setting affects only player HP.

## UI

The Create Lobby view adds compact controls inside the existing centered form:

- Damage: numeric stepper or slider with min `35`, max `100`, default `35`.
- Unique function hits: toggle, default on.
- Friendly fire: toggle, default off, visible or enabled only for team-versus mode.

The lobby setup screen shows these settings in a small match-rules summary. Once the match starts, the compact gameplay HUD does not need to show them unless a rejection occurs.

## Error Handling

- Missing gameplay settings default to `35`, `true`, and `false`.
- Invalid damage values are rejected by HTTP schema validation.
- Server-side normalization clamps only where local UI helpers need a preview; API schemas should reject out-of-range values.
- `friendlyFire: true` on free-for-all lobbies is accepted but has no gameplay effect.
- Unique-hit state resets on every new match.
- Rejected duplicate-hit shots leave players, terrain, turn number, and hit history unchanged.

## Testing

- Shared schema tests cover defaults, bounds, and invalid gameplay settings.
- Lobby directory tests cover storing settings, snapshots, and summaries.
- Create Lobby view tests cover controls, defaults, team-mode friendly-fire visibility, and submitted values.
- Store/API tests cover create-lobby payload propagation.
- Match controller tests cover damage options, duplicate-hit rejection, no turn consumption on rejection, and hit-history reset on new match.
- Shot simulator tests cover configured damage, no-friendly-fire teammate pass-through, friendly-fire teammate damage, and free-for-all behavior.
- Room integration tests cover two-client lobby creation with custom gameplay settings and authoritative shot outcomes.
- Playwright smoke coverage should verify the settings can be selected in the create-lobby flow and that a duplicate successful hit produces the rejection notice without advancing the turn.

## Out Of Scope

- Algebraic equivalence for unique function matching.
- Per-player or per-function-family damage modifiers.
- Area damage or terrain-explosion damage against players.
- Leaderboard damage and elimination stat aggregation changes.
- Mid-match settings changes.
- Friendly-fire penalties or team damage warnings.
