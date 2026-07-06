# Map Presentation, Camera, And Avatar Design

## Goal

Make match maps size-aware from lobby creation through server simulation and client rendering, add player-controlled camera zoom and pan, and render player avatars on the battlefield with color fallback.

## Scope

This is Phase 1 of the larger gameplay-settings request. It includes map size presets, custom-map bounds, camera controls, avatar identity plumbing, and map-maker size setup. It does not include hit damage settings, unique function hits, or friendly fire; those belong to Phase 2.

## Requirements

- Default maps use a lobby-selected map size preset.
- Presets are compact, mobile-friendly choices:
  - `small`: width `40`, height `24`
  - `standard`: width `50`, height `30`
  - `large`: width `75`, height `45`
  - `huge`: width `100`, height `60`
- Preset bounds are centered on `(0, 0)`.
- The default preset is `standard`, matching the current `fieldBounds`.
- The Create Lobby map-size control is shown only when `Default Map` is selected.
- Custom maps ignore the default map-size setting and use their own `worldBounds`.
- Older custom maps without `worldBounds` are still valid; the server derives bounds from terrain and spawn points with padding.
- Active match snapshots include authoritative `worldBounds`.
- Shot simulation clips against the active match bounds rather than fixed global bounds.
- The canvas initially fits the entire active map into the Discord-style 16:9 play area.
- Mouse wheel over the canvas zooms toward the cursor position and prevents page scrolling.
- Dragging the canvas pans the camera.
- When the active map changes, the camera resets to fit the new bounds.
- Player snapshots can include an optional `avatarUrl`.
- Local mock sessions can pass `avatar=<url>` in the query string.
- Discord session integration later fills `avatarUrl` from the Discord profile.
- Battlefield player icons render the avatar clipped to a circle when loaded.
- If no avatar is present or loading fails, the icon falls back to the player's selected color.
- The local map maker asks for map size when starting a new map and exports `worldBounds`.

## Architecture

Add a shared `WorldBounds` type and preset catalog. `fieldBounds` remains the standard preset and a compatibility fallback, but new code should pass active bounds explicitly. `GeneratedMap` gains `worldBounds`, `MatchSnapshot` gains `worldBounds`, and default map generators accept bounds when producing spawns and terrain.

Lobby state stores `mapSizePreset` for default-map lobbies. Custom-map lobbies still store only `mapId`; when the selected custom map has explicit bounds, those bounds become the match bounds. If a custom map has no bounds, a helper derives bounds from all terrain polygon points and spawn points, then adds padding.

The renderer moves from a fixed `fieldBounds` transform to a reusable camera transform:

```txt
worldBounds + canvas size -> fit camera
camera + world point -> canvas point
camera + canvas point -> world point
wheel(cursor) -> zoom around cursor world point
drag(delta) -> pan camera
```

`GameCanvas` owns camera state and pointer/wheel event handlers. `renderWorld` receives the active camera transform and snapshot bounds, so drawing remains stateless.

## Data Flow

1. Create Lobby submits `mapSizePreset` when `mapId` is absent.
2. Shared Zod schemas validate the preset.
3. `LobbyDirectory` stores the preset on runtime lobby state and snapshots.
4. `GameRoom` passes the preset or selected custom map bounds to `MatchController.startMatch()`.
5. `MatchController` asks the chosen map generator or custom map spawner for `GeneratedMap.worldBounds`.
6. `MatchSnapshot.worldBounds` is emitted to all clients.
7. `ShotSimulator` receives `worldBounds` and uses them for field-boundary clipping.
8. `GameCanvas` fits, zooms, and pans using `snapshot.worldBounds`.

## Default Map Generation

Team-versus and free-for-all generators should scale existing spawn and terrain layouts proportionally from standard bounds. This keeps current gameplay feel on `standard` while making larger maps genuinely larger:

- Team-versus team spawns stay near left and right sides.
- Free-for-all spawns remain distributed around the map.
- Terrain shapes scale with map width and height.
- Terrain ids remain stable.

## Custom Maps

The custom map format already allows optional `worldBounds`. Import validation continues to accept maps without bounds for backward compatibility. Server-side match start resolves custom map bounds in this order:

1. Use saved `map.worldBounds`.
2. Derive bounds from terrain vertices and spawn points.
3. Fall back to standard bounds if the map is empty.

Derived bounds should add enough padding that edge terrain, spawn points, and players are not flush against the canvas border.

## Map Maker

The map maker starts with a compact new-map setup state before entering the editor. The setup asks for map name and map size preset, with an optional custom bounds mode. The editor state stores `worldBounds`, the editor view uses those bounds for its SVG/canvas view box, and exports always include `worldBounds`.

Existing editor tools adapt to bounds:

- Shape tools place new shapes within visible bounds.
- The 10-spawn helper distributes spawn points inside the chosen bounds.
- Dragging and transforming objects continue to work in world coordinates.
- Export still uses shared validation.

## Avatar Rendering

`ClientSession` gains `avatarUrl?: string`. Local sessions read it from the `avatar` query parameter. Create/join lobby requests carry it as hidden identity metadata. Lobby occupants, lobby sessions, lobby players, and match player snapshots preserve it.

The renderer keeps a small image cache by URL. For each player:

1. Draw the circular selected-color background and active-player ring.
2. If `avatarUrl` has loaded successfully, clip the avatar image into the circle.
3. If loading is pending or failed, keep the selected-color circle.
4. Continue rendering name, team, and HP labels as today.

Avatar images are presentation-only. The server does not fetch or verify image contents.

## Error Handling

- Invalid map size presets are rejected by shared schemas.
- Invalid custom-map bounds are rejected by existing bounds validation.
- Create Lobby omits or ignores `mapSizePreset` for custom-map lobbies.
- Old lobby requests without `mapSizePreset` default to `standard`.
- Old custom maps without bounds use derived bounds.
- Avatar URLs that are empty, too long, or malformed are dropped.
- Failed avatar image loads never block rendering.

## Testing

- Shared schema tests cover map-size presets, world bounds, `mapSizePreset` defaults, and optional avatar URLs.
- Map generator tests cover standard bounds compatibility and scaled large/huge bounds.
- Custom map spawner tests cover explicit custom bounds and derived fallback bounds.
- Shot simulator tests cover field-boundary clipping against non-standard bounds.
- Match controller or room tests cover `worldBounds` propagation into match snapshots.
- Lobby directory and client create-lobby tests cover default-map `mapSizePreset` and custom-map hiding/ignore behavior.
- Session tests cover local `avatar` query parsing.
- Renderer tests cover transform fit, zoom-at-cursor math, pan math, and avatar fallback drawing.
- Map-maker tests cover setup bounds, editor state bounds, and exported `worldBounds`.
- Playwright smoke coverage should confirm a large default map or custom bounded map fits without page scrolling.

## Out Of Scope

- Hit damage lobby setting.
- Unique function hit enforcement.
- Friendly fire.
- Discord SDK avatar retrieval implementation details.
- Minimap, reset-view button, or touch pinch gestures.
- Public lobby browser filtering by map size.
