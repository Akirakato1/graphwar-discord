# Graphwar Discord Activity

Local-first prototype for a Graphwar-inspired Discord Activity. The first milestone is a browser-based multi-tab game that connects to a local authoritative server, while keeping the client/server boundary ready for Discord's Embedded App SDK later.

## Current Status

- Design specs:
  - `docs/superpowers/specs/2026-07-04-graphwar-discord-activity-design.md`
  - `docs/superpowers/specs/2026-07-05-lobby-menu-flow-design.md`
  - `docs/superpowers/specs/2026-07-05-gameplay-ui-fixes-design.md`
  - `docs/superpowers/specs/2026-07-06-custom-maps-and-map-maker-design.md`
  - `docs/superpowers/specs/2026-07-06-lobby-identity-settings-design.md`
  - `docs/superpowers/specs/2026-07-06-advanced-normal-function-math-design.md`
  - `docs/superpowers/specs/2026-07-06-map-presentation-camera-avatar-design.md`
  - `docs/superpowers/specs/2026-07-06-gameplay-settings-phase-2-design.md`
- Implementation plans:
  - `docs/superpowers/plans/2026-07-04-graphwar-discord-activity-prototype.md`
  - `docs/superpowers/plans/2026-07-05-aim-direction-hud.md`
  - `docs/superpowers/plans/2026-07-05-lobby-menu-flow.md`
  - `docs/superpowers/plans/2026-07-05-gameplay-ui-fixes.md`
  - `docs/superpowers/plans/2026-07-06-custom-maps-and-map-maker.md`
  - `docs/superpowers/plans/2026-07-06-lobby-identity-settings.md`
  - `docs/superpowers/plans/2026-07-06-advanced-normal-function-math.md`
  - `docs/superpowers/plans/2026-07-06-map-presentation-camera-avatar.md`
- Source mechanics notes: `graphwar_cheat_sheet.md`
- Active branch: `feature/graphwar-prototype`
- Remote branch: `origin/feature/graphwar-prototype`
- Current checkpoint: guild-scoped centered main menu, Custom Maps menu/import/delete flow, create/join lobby flow with custom map selection, player color selection, per-lobby max function length and gameplay settings including Advanced functions and Function preview toggles, default-map size preset metadata, lobby previews that honor selected map size before match start, authoritative server world bounds in match snapshots, generated/default/custom-map bounds propagation, leader crown markers, group-header join buttons for teams/spectators, leader-controlled setup, spectator support, server-enforced spectator settings, persisted leaderboard entries, guild-scoped persisted custom map storage and HTTP map APIs, lobby selected-map metadata, custom-map match-start terrain/spawn loading, a local Electron map maker that exports validated `.graphwar-map.json` files with zoom-at-cursor and pan controls, CORS/WebSocket origin allowlist defaults and environment override, server-issued lobby session tokens for guild WebSocket commands, schema-validating WebSocket client, Zustand room store, shared normal-function parsing/sampling for server simulation and client previews, normal-function shot input palette with floor/ceiling in normal mode, advanced-only sum/integral/derivative/gamma/beta/zeta helpers, and implicit multiplication parser, 8-way rotated local aim axes, a compact in-turn HUD with own HP and direction dial, Canvas 2D battlefield rendering with player-selected colors, zoom-aware major/minor grid lines, linearly attenuated authoritative shot paths, and thin local function previews, a configurable per-lobby normal-shot arc-length travel cap defaulting to `50.0` units before field-boundary clipping, configurable player-hit damage from 35 to 100, configurable impact crater base radius from 0.5 to 3.0, unique successful function-hit rejection, optional team friendly fire, visible non-damaging range-limit fizzles that still consume the turn, remaining-length-scaled terrain crater radius, shot playback that stages terrain/player damage until visual impact and clears after animation, match-ending shot playback before a blocking winner popup, Discord 16:9 no-scroll viewport fitting, Playwright coverage for the visible create/join/spectator/final-shot/custom-map/gameplay-settings flow, an approved custom maps plus local Electron map-maker design, and shared custom map import/persistence contracts with strict map-file validation.
- Execution mode: subagent-driven development with review after each task

## Planned Stack

- TypeScript npm workspaces
- Vite + React client
- Canvas 2D renderer
- Fastify + `ws` server
- Zod shared protocol validation
- `expr-eval` for normal-function parsing
- `polygon-clipping` for terrain craters
- Electron + Vite + React for the separate local map maker
- Vitest + Playwright

## Current Workspace

The workspace now contains:

- `apps/client`: Vite + React browser activity prototype with local query-parameter sessions, a Discord session factory placeholder, guild-scoped centered main menu, Custom Maps library for importing `.graphwar-map.json` files and owner-only deletion, create/join lobby browser with default/custom map selection, alias and 10-color player identity selection, create-lobby max function length, damage-per-hit slider, impact crater base-radius slider, unique-hit, friendly-fire, advanced-function, and local function-preview settings, leader crown markers, group-header join controls for teams/spectators, leader setup controls, match settings and leaderboard views, visible alias entry for create/join forms, spectator gating for active matches, settings-aware create/join actions, validated WebSocket room client with lobby session tokens, Zustand game store, Canvas 2D battlefield rendering with player-selected marker/name colors, zoom-aware 5-unit major and subtle 1-unit minor grid lines, thin live local function previews from the draft expression and aim direction, authoritative shot path/impact playback with a distinct range-limit fizzle marker that remains visible through immediate turn advancement and match end, staged terrain/player HP display during shot travel, compact playing HUD, 8-way direction dial with mouse-wheel stepping, normal-function shot input with normal snippets plus advanced-only snippets when enabled, a focus-managed match-end winner modal with a single return-to-menu action, and Playwright coverage for the visible create/join/spectator flow, custom-map import/start flow, gameplay playback, gameplay settings, duplicate-hit rejection, final-shot winner flow, and 16:9 Discord-style viewport fit without page scrolling.
- `apps/server`: Fastify server with a `/health` route on port `8787`, `/guilds/:guildId/...` HTTP APIs, custom map list/save/delete routes, guild-scoped WebSocket upgrades at `/guilds/:guildId/rooms/:roomId`, guild WebSocket origin checks, server-issued lobby session tokens, normal-function parsing/sampling helpers with implicit multiplication and server-enforced advanced-helper gating for shot trajectories, authoritative rotated-axis shot simulation and collision resolution with a per-lobby normal-shot arc-length travel cap defaulting to `50.0` units before active world-boundary clipping, configurable player-hit damage and impact crater base radius, duplicate successful function-hit rejection, optional team friendly-fire filtering, `path-too-long` shot resolution that consumes the turn without damage or terrain mutation, server-side destructible terrain crater logic with crater radius scaled by remaining function length at impact, match mode rules, deterministic bounds-aware map generators, a custom map spawner for team-versus and free-for-all spawn assignment with explicit/derived/fallback bounds, a match controller for lobby joins, match starts, shot submissions, turn advancement, ordered match-ending `shot-resolved` then `match-ended` events, and victory resolution, persisted settings, leaderboard storage, custom map storage with owner-only deletion, a guild lobby directory with selected-map metadata, default-map size presets, player color identity, max function length and gameplay settings, a CORS allowlist, and a local room manager for command routing.
- `apps/map-maker`: local Electron + React map editor with Canvas-style SVG editing, preset or custom map dimensions, a saved-map browser for editing, importing older map JSON files, renaming, deleting, and opening the saved-map folder, standard save/overwrite behavior for opened maps through the native Electron preload bridge, explicit missing-file-API feedback when opened outside Electron, mouse-wheel zoom-at-cursor clamped to the map, middle mouse or Space+drag panning without exposing void outside the map, 5-unit major and subtle zoom-gated 1-unit minor grid lines, rectangle/triangle/circle terrain tools placed by right-click, left-click selection and dragging without changing tools, a pen tool with right-click undo and close-to-first-node completion, bounds-clamped draggable terrain and spawn points, transform handles for terrain scaling, team A/team B spawn assignment, a 10-spawn helper, and native save to shared-validated `.graphwar-map.json`.
- `packages/shared`: shared constants, geometry/state types, 8-way aim direction and coordinate helpers, polygon helpers, shared normal-function parsing/sampling helpers, terrain normalization for overlapping custom-map terrain, function validation settings, client command types, server event types, and Zod schemas for runtime protocol validation with compile-time protocol alignment checks.
- Root TypeScript project references, Vitest config, and Playwright config.

## Install And Checks

```bash
npm install
npm test -- apps/server/src/functions/NormalFunction.test.ts
npm test -- apps/server/src/simulation/ShotSimulator.test.ts
npm test -- apps/server/src/terrain/TerrainSystem.test.ts
npm test -- apps/server/src/modes apps/server/src/maps
npm test -- apps/server/src/maps/CustomMapSpawner.test.ts
npm test -- apps/server/src/match/MatchController.test.ts
npm test -- apps/server/src/rooms/RoomManager.integration.test.ts
npm test -- apps/server/src/persistence/LocalStateStore.maps.test.ts apps/server/src/index.test.ts
npm test -- apps/client/src/game-renderer
npm test -- apps/client/src/input apps/client/src/hud
npm test -- apps/client/src
npm run test:e2e -- apps/client/e2e/custom-maps.spec.ts
npm test -- packages/shared/src/protocol/schemas.test.ts
npm test -- packages/shared/src/geometry
npm run check
npm test
npm run test:e2e
npm --workspace apps/client run build
npm --workspace apps/server run build
npm --workspace apps/map-maker run build
```

The current checks compile the project references, validate normal-function parsing/sampling, authoritative shot simulation and collision resolution, terrain crater removal, match mode rules, deterministic map generators, match controller orchestration, WebSocket room integration, client local-session/network/store/UI/renderer behavior, function input palette insertion behavior, shared protocol schemas, and geometry helpers with Vitest, run the full Vitest suite, exercise visible create/join/spectator local lobby and gameplay flows plus 16:9 no-scroll viewport smoke tests with Playwright, and verify the client and server build outputs.

## Discord Viewport Constraint

All first-party gameplay and lobby UI must fit inside a Discord Activity-style 16:9 viewport without page scrolling. Nonessential panels such as event logs, debug/status surfaces, and setup-only details should be hidden or compressed when irrelevant, especially during gameplay and phone landscape layouts.

## Local Development Target

The local playable loop runs with one server and multiple mock browser clients:

```bash
npm install
npm run dev
```

Open separate browser tabs with different mock Discord users:

```txt
http://localhost:5173/?guild=local-guild&user=alice
http://localhost:5173/?guild=local-guild&user=bob
http://localhost:5173/?guild=local-guild&user=charlie
```

Local clients now start on the main menu. Alice can create a lobby, Bob can join it from the guild-scoped lobby browser after entering a unique alias and choosing one of 10 player colors, and Charlie can join an active match as a spectator when the guild setting allows spectators. The local query parameters identify the mock Discord guild and user; the visible alias and color are entered in the create/join form. Lobby leaders show a small crown next to their name, and players move themselves between teams/spectators using the group-header join buttons.

Use the main menu `Custom Maps` button to import a `.graphwar-map.json` file for the current mock guild. Imported maps are visible only to clients using the same `guild` query parameter. The user who imported a map can delete it from the Custom Maps screen. Create Lobby includes a `Map` selector with `Default Map` plus saved guild custom maps.

To build and launch the local desktop map maker:

```bash
npm --workspace apps/map-maker run build
npm --workspace apps/map-maker run start
```

The map maker saves `.graphwar-map.json` files to a managed `Graphwar Maps` folder under Documents. New maps start with an empty name and cannot start until the name is non-empty and unique among saved maps. Use `Browse Existing Maps` to refresh the managed library, see the exact folder path, import older exported map JSON files from any location, edit, rename, or delete saved maps with confirmation before delete, and `Open Folder` to reveal the saved-map folder in Explorer. Saving an opened map with the same name overwrites the same file; changing the name saves as a new non-clashing map. Save confirmations clear after a few seconds. If the map maker is opened outside Electron, the setup screen reports that native file access is unavailable instead of silently showing an empty library. Use the preset sizes or the Custom size fields on the start screen, the mouse wheel to zoom around the cursor, middle mouse or Space+drag to pan, and the 5-unit major grid plus zoom-gated subtle 1-unit minor grid for placement. Left click selects and drags existing terrain/spawns regardless of the active stamp tool; right click places rectangle, triangle, circle, or spawn tools. Pen mode uses left click on empty map space to add nodes and right click to undo. Zoom-out and panning clamp to the map bounds, editing tools clamp terrain/spawns inside those bounds, and exported overlapping terrain is unioned into playable terrain. The server normalizes overlapping terrain again when loading saved maps, so older raw files remain compatible. Import the saved file from the Activity's `Custom Maps` menu, then select it from the Create Lobby `Map` field.

By default the client opens guild-scoped WebSockets through the local server after lobby selection, using routes like `ws://<current hostname>:8787/guilds/:guildId/rooms/:roomId`. HTTP create/join returns a server-issued lobby session token; the client sends it on the WebSocket join and later lobby commands so the server can reject spoofed player ids. Add `server=ws://host:port` to the query string to override the WebSocket base during local testing.

During a match, the active player chooses one of 8 facing directions before firing. The function is evaluated in shooter-local coordinates, so local `+x` points in the selected facing direction and local `+y` rotates with it. Use the direction dial buttons or scroll the mouse wheel over the dial to rotate aim. When Function preview is enabled for the lobby, the local client draws a thin light-yellow preview of the current draft expression and aim direction up to the configured arc-length cap; previews update while typing or changing direction, are hidden for invalid expressions, and remain local-only even while waiting for another player's turn. The server simulates the rotated path authoritatively with `0.025` local-x sampling and limits range by accumulated segment distance along the path, defaulting to a `50.0` unit normal-shot arc-length travel cap before field-boundary clipping. Clients render the returned path with opacity linearly fading from 95% to a still-visible 20% over the returned path. If the path reaches the max function length without contacting terrain, a player, or the field boundary, it resolves as `path-too-long`: the shot consumes the turn, leaves terrain/players unchanged, and clients draw a small fizzle at the endpoint. Terrain crater radius scales with remaining function length at contact, from `2x` base radius at full remaining length down to `1x` at zero remaining length. If the server advances the turn or ends the match immediately after resolving the shot, the client still plays the shot animation first, keeps terrain/player HP in the pre-shot visual state while the function travels, applies impact/damage visuals at contact, and clears the visible function path after playback completes. Match-ending shots emit `shot-resolved` before `match-ended`, then clients show a blocking winner popup with winner names and a single `Return to Menu` action.

Create Lobby also controls gameplay rules for the match: direct player-hit damage can be set from `35` through `100`, impact crater base radius can be set from `0.5` through `3.0` in `0.25` steps before the remaining-length multiplier is applied, unique successful function hits are enabled by default so the same shooter cannot reuse the same canonical expression/direction on the same target, team-versus lobbies can optionally enable friendly fire, Advanced functions can unlock heavier math helpers for that lobby, and Function preview toggles the local draft trajectory guide. Canonical duplicate checks use the server parser form, so whitespace, `y =` prefixes, and implicit-multiplication aliases resolve to the same hit identity. These settings are stored on the server lobby, shown in the setup screen, and applied authoritatively when the match starts.

Normal-function input accepts explicit operators, floor/ceiling, and common implicit multiplication forms. Examples include `3sin(2x)cos(x)`, `2(x+1)`, `cos(x)(-sin(x))`, `-abs(x)`, `floor(x)`, `ceil(x)`, and `ceiling(x)`. Division remains explicit, so `sin(x)/(-2-cos(x))` and `sin(x)/-(cos(x)+2)` are equivalent supported inputs.

When Advanced functions is enabled for the lobby, normal-function input also accepts aggregate and special-function helpers. Examples include `sum(n,0,x,n*cos(x))`, `int(t,0,x,sin(t*x))`, `diff(x,2,sin(x))`, `gamma(x)`, `factorial(x)`, `digamma(x)`, `beta(x,2)`, and `zeta(x+2)`. The sampled local `x` is available inside summation/integration bounds and bodies. These helpers are evaluated numerically on the server with fixed safety caps. When Advanced functions is off, the server rejects these helpers even if a player types them manually.

To run the built server artifact instead of the watch-mode dev server:

```bash
npm --workspace apps/server run build
npm --workspace apps/server run start
```

## Implementation Checkpoints

Every major implementation task should:

1. Update this README when the user-facing state changes.
2. Run the relevant verification commands.
3. Commit the checkpoint.
4. Push the checkpoint branch with SSH after each major change.

## Checkpoint Log

- `74c6e70`: Added initial README and tracked Graphwar mechanics notes.
- Scaffolded the TypeScript workspace with client, server, and shared packages.
- `3c28af9`: Defined shared game constants, domain types, validation settings, and protocol schemas.
- Added shared coordinate and polygon helpers with validated circle polygon inputs and targeted geometry coverage.
- Added lobby/menu flow design covering guild-scoped lobby browsing, create/join flow, alias uniqueness, leader controls, spectators, settings, and leaderboard persistence.
- Added lobby/menu flow implementation plan covering shared contracts, server persistence, guild-scoped lobby runtime, client menu/setup views, spectator gating, E2E conversion, and checkpoint commits.
- Current: added the client-side local session boundary, future Discord session placeholder, schema-validated WebSocket client, Zustand store actions for room commands/events, a usable multi-tab lobby/match control surface, Canvas 2D world rendering with staged shot path/impact playback, a normal-function shot input palette, implicit multiplication for normal-function parsing, 8-way rotated local aim directions, minimal in-turn HUD, 95%-to-20% shot path opacity attenuation, terrain/player damage staging through immediate turn advancement, Discord 16:9 no-scroll viewport fitting, and Playwright smoke tests for `alice`/`bob` local testing.
- Added guild-scoped main menu, create/join lobby flow, leader-controlled setup, spectator support, persisted settings, persisted leaderboard entries, and Playwright coverage for mock clients using the same flow as Discord users.
- Hardened lobby lifecycle and authority: ended lobbies are hidden from join listings, spectator-disabled guild settings are enforced by server and client, guild WebSocket upgrades check the origin allowlist, and lobby WebSocket commands are bound to the HTTP-issued session token.
- Added a focused gameplay/UI fixes design covering the halved shot travel limit, final-shot animation ordering, match-end winner popup, and centered main menu checkpoint.
- Added a gameplay/UI fixes implementation plan for server shot sequencing, client match-end modal flow, E2E coverage, centered menu styling, and verification.
- Halved normal shot travel to `50.0` units before field-boundary clipping, sequenced match-ending shots as `shot-resolved` before `match-ended`, added a focus-managed winner popup with only `Return to Menu`, centered the main menu, and expanded Playwright coverage for final-shot playback before match end.
- Added an approved custom maps and local Electron map-maker design covering guild-scoped persisted map storage, a Custom Maps menu flow, create-lobby map selection, custom-map spawn assignment for team-versus/free-for-all, and a desktop editor that exports `.graphwar-map.json`.
- Added a custom maps and local map-maker implementation plan covering shared schemas, server persistence/API, lobby map selection, custom-map match start, client import/manage UI, Electron editor/export, and E2E verification checkpoints.
- Added shared custom map contracts and Zod validation for `.graphwar-map.json` imports, persisted map metadata, save requests, lobby selected-map metadata, strict terrain polygon rings, spawn count, duplicate spawn ids, and team-spawn references.
- Added server-side custom map persistence and guild HTTP APIs for listing, saving, validating, and owner-only deleting custom maps, including lazy migration for existing state files and CORS support for `DELETE`.
- Added lobby selected-map metadata and server-side custom-map match loading, including team-specific spawn assignment, deterministic free-for-all separation, custom terrain injection into match snapshots, and failure handling that keeps invalid custom-map lobbies open.
- Added the client Custom Maps menu flow, map file import validation, owner-only delete UI, guild map API client methods, store map actions, and a create-lobby map selector while preserving the Discord 16:9 no-scroll layout.
- Added a local Electron map maker with shared validation, terrain shape tools, pen polygon creation, draggable and scalable terrain, spawn placement, team spawn subsets, native `.graphwar-map.json` export, and build scripts.
- Added a Playwright custom-map smoke test covering import through the main menu, custom map selection during lobby creation, second-client join, and match start with the selected map.
- Fixed the map maker production build to emit relative renderer asset paths so Electron `loadFile` can load the bundled UI instead of opening a blank window.
- Added an approved lobby identity/settings design covering player colors, leader crown markers, group-header join buttons, centered lobby creation, and per-lobby maximum function length.
- Added a lobby identity/settings implementation plan covering shared contracts, server shot-length tuning, client lobby controls, color-aware rendering, and E2E updates.
- Added shared/server/client lobby identity settings: 10 fixed player colors, lobby leader crowns, group-header join buttons, centered compact create-lobby UI, color-aware in-game rendering, and a server-authoritative per-lobby max function length with focused Vitest and local-lobby Playwright coverage.
- Added visible max-range fizzles: range-limited shots now resolve as `path-too-long`, preserve terrain/player state, still advance the turn, and render a non-explosion endpoint marker.
- Refined the max-range fizzle marker to use circular spark particles instead of straight crossed strokes so it cannot read as extra function beams.
- Changed max function length from local-x distance to true traveled path distance using accumulated segment length, while halving shot sampling `dx` to `0.025` and preserving the default `50.0` unit cap.
- Added an approved advanced normal-function math design covering summation, numeric integration, finite-difference derivatives, gamma/factorial/digamma/beta helpers, floor/ceiling palette entries, and server-side evaluation guardrails.
- Added an advanced normal-function math implementation plan covering the server expression compiler, special math helpers, client palette snippets, README updates, and verification commands.
- Added advanced normal-function math helpers for server-authoritative summation, numeric integration, finite-difference derivatives, gamma-family functions, floor/ceiling aliases, and mathematical palette snippets.
- Added an approved Phase 1 map presentation design covering default map-size presets, authoritative match bounds, custom-map bounds fallback, camera zoom/pan, avatar rendering, and map-maker size setup.
- Added a Phase 2 gameplay-settings design covering configurable player-hit damage, unique successful function hits, friendly-fire target filtering, lobby rule propagation, and focused tests.
- Added a Phase 2 gameplay-settings implementation plan covering shared contracts, lobby storage, simulation rules, client lobby UI, and integration/E2E verification.
- Added shared Phase 2 gameplay-setting contracts for damage-per-hit bounds/defaults, unique-hit and friendly-fire defaults, normalization helpers, and lobby schema fields.
- Stored Phase 2 gameplay settings on runtime lobbies, lobby summaries, room snapshots, and match-start propagation.
- Enforced Phase 2 server simulation rules for configured hit damage, team friendly-fire filtering, and duplicate successful function-hit rejection.
- Added Phase 2 client lobby UI for damage, unique-hit, and friendly-fire setup plus read-only match rules.
- Phase 2 gameplay settings are now implemented end-to-end: lobby-created damage values propagate into live WebSocket matches, duplicate successful function hits are rejected without consuming the turn, team friendly-fire filtering is configurable, and Playwright covers the create-lobby settings plus duplicate-hit warning flow.
- Added a Phase 1 map presentation implementation plan covering shared bounds contracts, server propagation, client camera/avatar rendering, map-maker bounds setup, and verification checkpoints.
- Added shared Phase 1 map presentation contracts for map-size presets, reusable world bounds, sanitized avatar URLs, lobby map-size metadata, and optional snapshot bounds during server migration.
- Propagated authoritative world bounds server-side for Phase 1 map presentation: default map-size presets feed generated maps and match snapshots, custom maps use explicit/derived/fallback bounds, shot simulation clips against active bounds, lobby summaries store default-map presets only, and `MatchSnapshot.worldBounds` is now required.
- Added client avatar identity plumbing and default-map size preset selection for create/join lobby flows, including `join-room` avatar forwarding.
- Added a bounds-aware battlefield camera with fit/zoom/pan helpers, snapshot world-bounds canvas metadata, and clipped avatar rendering with a color fallback.
- Added map-maker bounds setup with a local start screen, active world-bounds SVG/export plumbing, and 5v5 default spawn generation inside the chosen map size.
- Phase 1 map presentation is now implemented end-to-end: default map-size presets, authoritative bounds, custom-map bounds/export validation, camera zoom/pan, avatar fallback, and map-maker bounds setup.
- Fixed lobby-phase room snapshots so default-map previews use the selected map size before the match starts.
- Hardened custom-map editing and loading: the map maker supports custom width/height, clamps placement, dragging, scaling, zoom, and pan to map bounds, exports overlapping terrain as a union, and the server normalizes overlapping saved terrain before match simulation.
- Changed map-maker placement to right-click stamp tools and left-click selection/dragging, eliminating post-drag accidental shape creation and adding guards for zero-size canvas measurements plus non-finite pointer coordinates.
- Added a local map-maker saved-map library: new maps require unique names, saved maps can be browsed, edited, renamed, deleted with confirmation, opened in Explorer, and saved again with standard same-file overwrite behavior plus transient save feedback.
- Improved map-maker saved-map troubleshooting and migration: the browser shows the managed folder path, reports missing Electron file APIs, opens the folder with a success message, and imports older exported map JSON files into the managed library.
- Fixed and verified the Electron map-maker save path: the preload bridge is now built as CommonJS for Electron, map-name input no longer crashes on edit, and an automated Electron UI save check writes a `.graphwar-map.json` into the managed Documents folder and reads it back successfully.
- Changed selected map-maker spawn points to keep their normal fill color and show selection with a separate white outline ring instead of a yellow fill.
- Added map-maker marquee multi-select for terrain and spawns, Ctrl+left-click selection toggling, group movement, and Ctrl+C/Ctrl+V copy-paste with pasted copies offset, selected, and preserving spawn team assignments.
- Hid the native Electron menu chrome in the map maker and added an editor `Main Menu` button that exits back to the setup/library screen.
- Kept the create-lobby screen fixed to the Discord-sized viewport by making the lobby settings form itself scroll internally when its controls exceed the available panel height.
- Added a per-lobby Advanced functions setting: floor/ceiling remain available in normal mode, while sum, integral, derivative, gamma, factorial, digamma, beta, and zeta are shown only when enabled and rejected server-side otherwise.
- Added per-lobby Function preview support with shared client/server normal-function sampling, off-turn draft editing and direction changes, a thin local-only preview path, a stable direction-dial label layer, and remaining-length-scaled terrain crater radii.
- Added a per-lobby impact crater base-radius slider from `0.5` to `3.0`, changed damage setup to a slider, and propagated crater radius through lobby snapshots, match rules, authoritative shot simulation, and setup summaries.
