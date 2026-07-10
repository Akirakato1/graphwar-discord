# Graphwar Discord Activity

Local-first prototype for a Graphwar-inspired Discord Activity. It runs as a multi-tab browser game backed by an authoritative local server, with the client/server boundary kept ready for Discord Activity integration later.

## Features

- Guild-scoped lobbies with aliases, colors, spectators, team-versus, and free-for-all.
- Server-authoritative turns, timers, shots, damage, terrain destruction, safe default spawns, forfeits, and match end.
- Function input with rotated local aim axes, implicit multiplication, LaTeX-style display, advanced helpers, keypad/keyboard/hybrid modes, and trajectory preview.
- Canvas battlefield with zoom/pan, grid lines, compact HUD, player markers, shot playback, range fizzles, sounds, and winner popup.
- Animated equation background on the main menu.
- Custom map loading plus an Electron map maker for `.graphwar-map.json` files.

## Quick Start

```bash
npm install
npm run dev
```

Open two or more browser tabs:

```txt
http://localhost:5173/?guild=local-guild&user=alice
http://localhost:5173/?guild=local-guild&user=bob
http://localhost:5173/?guild=local-guild&user=charlie
```

Alice can create a lobby, Bob can join it, and Charlie can join as a player or spectator. The `guild` query parameter scopes lobbies/maps/stats; `user` mocks the Discord user id.

## Map Maker

Launch the local Electron map editor:

```bash
npm run dev:map-maker
```

Import saved maps from the game's `Custom Maps` menu, then select them when creating a lobby.

## Useful Commands

```bash
npm run dev                  # server + browser client
npm run dev:server           # server only
npm run dev:client           # browser client only
npm run dev:map-maker        # Electron map maker
npm run check                # TypeScript project references
npm test                     # Vitest unit/integration suite
npm run test:e2e             # Playwright browser tests
npm run build:map-maker      # build map maker
```

## Project Layout

```txt
apps/client       Browser activity prototype
apps/server       Fastify + WebSocket authoritative game server
apps/map-maker    Electron + React custom map editor
packages/shared   Shared types, schemas, geometry, maps, functions, protocol
docs/superpowers  Design specs and plans
```

## Verification

```bash
npm run check
npm test
```

Run Playwright for lobby/gameplay UI changes:

```bash
npm run test:e2e
```

## Discord Direction

Local browser tabs are mock Discord clients. To ship as a real Activity, replace the query-parameter session factory with Discord Embedded App SDK identity/guild data and host the client/server over HTTPS/WSS.
