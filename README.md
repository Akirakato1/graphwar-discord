# Graphwar Discord Activity

Local-first prototype for a Graphwar-inspired Discord Activity. The first milestone is a browser-based multi-tab game that connects to a local authoritative server, while keeping the client/server boundary ready for Discord's Embedded App SDK later.

## Current Status

- Design spec: `docs/superpowers/specs/2026-07-04-graphwar-discord-activity-design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-04-graphwar-discord-activity-prototype.md`
- Source mechanics notes: `graphwar_cheat_sheet.md`
- Active branch: `feature/graphwar-prototype`
- Remote branch: `origin/feature/graphwar-prototype`
- Current checkpoint: TypeScript npm workspace scaffold with `apps/client`, `apps/server`, and `packages/shared`
- Execution mode: subagent-driven development with review after each task

## Planned Stack

- TypeScript npm workspaces
- Vite + React client
- Canvas 2D renderer
- Fastify + `ws` server
- Zod shared protocol validation
- `expr-eval` for normal-function parsing
- `polygon-clipping` for terrain craters
- Vitest + Playwright

## Current Workspace

The scaffold now contains:

- `apps/client`: Vite + React shell for the browser activity prototype.
- `apps/server`: Fastify server with a `/health` route on port `8787`.
- `packages/shared`: shared TypeScript package placeholder for later protocol and domain types.
- Root TypeScript project references, Vitest config, and Playwright config.

## Install And Checks

```bash
npm install
npm run check
npm test
```

The current checks compile the project references and run Vitest. There are not yet test files in this first scaffold checkpoint.

## Local Development Target

The first playable loop will run with one server and multiple mock browser clients:

```txt
http://localhost:5173/?room=local-test&mockPlayer=alice
http://localhost:5173/?room=local-test&mockPlayer=bob
http://localhost:5173/?room=local-test&mockPlayer=charlie
```

## Implementation Checkpoints

Every major implementation task should:

1. Update this README when the user-facing state changes.
2. Run the relevant verification commands.
3. Commit the checkpoint.
4. Push the branch with SSH.

## Checkpoint Log

- `74c6e70`: Added initial README and tracked Graphwar mechanics notes.
- Current: scaffold the TypeScript workspace.
