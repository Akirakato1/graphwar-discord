# Graphwar Discord Activity

Local-first prototype for a Graphwar-inspired Discord Activity. The first milestone is a browser-based multi-tab game that connects to a local authoritative server, while keeping the client/server boundary ready for Discord's Embedded App SDK later.

## Current Status

- Design specs:
  - `docs/superpowers/specs/2026-07-04-graphwar-discord-activity-design.md`
  - `docs/superpowers/specs/2026-07-05-lobby-menu-flow-design.md`
  - `docs/superpowers/specs/2026-07-05-gameplay-ui-fixes-design.md`
  - `docs/superpowers/specs/2026-07-06-custom-maps-and-map-maker-design.md`
- Implementation plans:
  - `docs/superpowers/plans/2026-07-04-graphwar-discord-activity-prototype.md`
  - `docs/superpowers/plans/2026-07-05-aim-direction-hud.md`
  - `docs/superpowers/plans/2026-07-05-lobby-menu-flow.md`
  - `docs/superpowers/plans/2026-07-05-gameplay-ui-fixes.md`
  - `docs/superpowers/plans/2026-07-06-custom-maps-and-map-maker.md`
- Source mechanics notes: `graphwar_cheat_sheet.md`
- Active branch: `feature/graphwar-prototype`
- Remote branch: `origin/feature/graphwar-prototype`
- Current checkpoint: guild-scoped centered main menu, Custom Maps menu/import/delete flow, create/join lobby flow with custom map selection, leader-controlled setup, spectator support, server-enforced spectator settings, persisted leaderboard entries, guild-scoped persisted custom map storage and HTTP map APIs, lobby selected-map metadata, custom-map match-start terrain/spawn loading, a local Electron map maker that exports validated `.graphwar-map.json` files, CORS/WebSocket origin allowlist defaults and environment override, server-issued lobby session tokens for guild WebSocket commands, schema-validating WebSocket client, Zustand room store, normal-function shot input palette and implicit multiplication parser, 8-way rotated local aim axes, a compact in-turn HUD with own HP and direction dial, Canvas 2D battlefield rendering with linearly attenuated authoritative shot paths, a `50.0` unit normal-shot travel cap before field-boundary clipping, shot playback that stages terrain/player damage until visual impact and clears after animation, match-ending shot playback before a blocking winner popup, Discord 16:9 no-scroll viewport fitting, Playwright coverage for the visible create/join/spectator/final-shot flow, an approved custom maps plus local Electron map-maker design, and shared custom map import/persistence contracts with strict map-file validation.
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

- `apps/client`: Vite + React browser activity prototype with local query-parameter sessions, a Discord session factory placeholder, guild-scoped centered main menu, Custom Maps library for importing `.graphwar-map.json` files and owner-only deletion, create/join lobby browser with default/custom map selection, leader setup controls, match settings and leaderboard views, visible alias entry for create/join forms, spectator gating for active matches, settings-aware create/join actions, validated WebSocket room client with lobby session tokens, Zustand game store, Canvas 2D battlefield rendering, authoritative shot path/impact playback that remains visible through immediate turn advancement and match end, staged terrain/player HP display during shot travel, compact playing HUD, 8-way direction dial with mouse-wheel stepping, normal-function shot input with snippet buttons for common functions, constants, operators, and templates, a focus-managed match-end winner modal with a single return-to-menu action, and Playwright coverage for the visible create/join/spectator flow, gameplay playback, final-shot winner flow, and 16:9 Discord-style viewport fit without page scrolling.
- `apps/server`: Fastify server with a `/health` route on port `8787`, `/guilds/:guildId/...` HTTP APIs, custom map list/save/delete routes, guild-scoped WebSocket upgrades at `/guilds/:guildId/rooms/:roomId`, guild WebSocket origin checks, server-issued lobby session tokens, normal-function parsing/sampling helpers with implicit multiplication for shot trajectories, authoritative rotated-axis shot simulation and collision resolution with a `50.0` unit normal-shot travel cap before field-boundary clipping, server-side destructible terrain crater logic, match mode rules, deterministic map generators, a custom map spawner for team-versus and free-for-all spawn assignment, a match controller for lobby joins, match starts, shot submissions, turn advancement, ordered match-ending `shot-resolved` then `match-ended` events, and victory resolution, persisted settings, leaderboard storage, custom map storage with owner-only deletion, a guild lobby directory with selected-map metadata, a CORS allowlist, and a local room manager for command routing.
- `apps/map-maker`: local Electron + React map editor with Canvas-style SVG editing, rectangle/triangle/circle terrain tools, a pen tool with right-click undo and close-to-first-node completion, draggable terrain and spawn points, transform handles for terrain scaling, team A/team B spawn assignment, a 10-spawn helper, and native export to shared-validated `.graphwar-map.json`.
- `packages/shared`: shared constants, geometry/state types, 8-way aim direction and coordinate helpers, polygon helpers, function validation settings, client command types, server event types, and Zod schemas for runtime protocol validation with compile-time protocol alignment checks.
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

Local clients now start on the main menu. Alice can create a lobby, Bob can join it from the guild-scoped lobby browser after entering a unique alias, and Charlie can join an active match as a spectator when the guild setting allows spectators. The local query parameters identify the mock Discord guild and user; the visible alias is entered in the create/join form.

Use the main menu `Custom Maps` button to import a `.graphwar-map.json` file for the current mock guild. Imported maps are visible only to clients using the same `guild` query parameter. The user who imported a map can delete it from the Custom Maps screen. Create Lobby includes a `Map` selector with `Default Map` plus saved guild custom maps.

To build and launch the local desktop map maker:

```bash
npm --workspace apps/map-maker run build
npm --workspace apps/map-maker run start
```

The map maker exports `.graphwar-map.json` files through a native save dialog. Import the exported file from the Activity's `Custom Maps` menu, then select it from the Create Lobby `Map` field.

By default the client opens guild-scoped WebSockets through the local server after lobby selection, using routes like `ws://<current hostname>:8787/guilds/:guildId/rooms/:roomId`. HTTP create/join returns a server-issued lobby session token; the client sends it on the WebSocket join and later lobby commands so the server can reject spoofed player ids. Add `server=ws://host:port` to the query string to override the WebSocket base during local testing.

During a match, the active player chooses one of 8 facing directions before firing. The function is evaluated in shooter-local coordinates, so local `+x` points in the selected facing direction and local `+y` rotates with it. Use the direction dial buttons or scroll the mouse wheel over the dial to rotate aim. The server simulates the rotated path authoritatively up to a `50.0` unit normal-shot travel cap before field-boundary clipping, then clients render the returned path with opacity linearly fading from 95% to a still-visible 20% over the returned path. If the server advances the turn or ends the match immediately after resolving the shot, the client still plays the shot animation first, keeps terrain/player HP in the pre-shot visual state while the function travels, applies impact/damage visuals at contact, and clears the visible function path after playback completes. Match-ending shots emit `shot-resolved` before `match-ended`, then clients show a blocking winner popup with winner names and a single `Return to Menu` action.

Normal-function input accepts explicit operators and common implicit multiplication forms. Examples include `3sin(2x)cos(x)`, `2(x+1)`, `cos(x)(-sin(x))`, and `-abs(x)`. Division remains explicit, so `sin(x)/(-2-cos(x))` and `sin(x)/-(cos(x)+2)` are equivalent supported inputs.

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
