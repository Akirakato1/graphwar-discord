# Graph Report - Graphwar Discord Activity  (2026-07-10)

## Corpus Check
- 181 files · ~131,255 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1594 nodes · 3441 edges · 98 communities (86 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3b53ef08`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- useGameStore.test.ts
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 74
- Constants And Rules
- File Structure
- Lobby Identity And Settings Implementation Plan
- File Structure
- Gameplay UI Fixes Design
- Lobby Identity And Settings Design
- Graphwar / Graphwar II — Cheat Sheet
- Graphwar Discord Activity
- File Structure
- Global Constraints
- Aim Direction HUD Implementation Plan
- AGENTS.md
- MatchHud.tsx
- types.ts
- DirectionDial.tsx
- LobbyPanel.tsx
- MapLibraryView.tsx
- lobbyApi.test.ts
- LeaderboardView.tsx
- SettingsView.tsx
- LocalStateStore.maps.test.ts

## God Nodes (most connected - your core abstractions)
1. `WorldPoint` - 44 edges
2. `LobbyDirectory` - 34 edges
3. `MatchController` - 34 edges
4. `GameRoom` - 34 edges
5. `PlayerId` - 30 edges
6. `WorldBounds` - 28 edges
7. `MatchModeId` - 26 edges
8. `App()` - 25 edges
9. `ShotSimulator` - 25 edges
10. `worldBoundsForMapSize()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `terrainArea()` --calls--> `polygonArea()`  [EXTRACTED]
  apps/server/src/simulation/ShotSimulator.test.ts → packages/shared/src/geometry/polygons.ts
- `fitCameraToBounds()` --calls--> `boundsHeight()`  [EXTRACTED]
  apps/client/src/game-renderer/camera.ts → packages/shared/src/maps/worldBounds.ts
- `fitCameraToBounds()` --calls--> `boundsWidth()`  [EXTRACTED]
  apps/client/src/game-renderer/camera.ts → packages/shared/src/maps/worldBounds.ts
- `computeFunctionPreview()` --calls--> `parseNormalFunction()`  [EXTRACTED]
  apps/client/src/game-renderer/functionPreview.ts → packages/shared/src/functions/normalFunction.ts
- `computeFunctionPreview()` --calls--> `localToWorld()`  [EXTRACTED]
  apps/client/src/game-renderer/functionPreview.ts → packages/shared/src/geometry/coordinates.ts

## Import Cycles
- None detected.

## Communities (98 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (33): cloneSnapshot(), emptyTerrain, ForfeitEvents, lobbyPosition, LobbySnapshotOptions, MatchController, MatchControllerOptions, MatchEndedEvent (+25 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (11): LobbySessionIdentity, parseCommand(), GameRoom, LobbyContext, RoomManager, ClientCommand, SubmitShotCommand, ServerEvent (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (42): advancedFunctionSymbols, assertAdvancedFunctionsAllowed(), baseFunctionSymbols, baseValueSymbols, canEndFactor(), canStartFactor(), compileDerivative(), CompiledNormalExpression (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (17): customMapImportSchema, customMapSpawnPointSchema, customMapTeamSpawnPointIdsSchema, customMapTerrainBlobSchema, customMapTerrainRingSchema, customMapTerrainStateSchema, mapNameSchema, persistedCustomMapSchema (+9 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (14): lobbyPlacementSchema, lobbySlotSchema, matchModeSchema, playerColorSchema, aimDirectionSchema, clientCommandUnionSchema, finiteNumberSchema, nonNegativeFiniteNumberSchema (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (35): copySelected(), deleteSelected(), isItemSelected(), selectedItems(), App(), boundsFromHandle(), boundsFromPoints(), boundsLabel() (+27 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (49): advancedFunctionSymbols, assertAdvancedFunctionsAllowed(), baseFunctionSymbols, baseValueSymbols, canEndFactor(), canStartFactor(), compileDerivative(), CompiledNormalExpression (+41 more)

### Community 7 - "Community 7"
Cohesion: 0.39
Nodes (6): computeFunctionPreview(), distance(), FunctionPreviewInput, resolveMaxFunctionLength(), snapshot, truncatePathByDistance()

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (29): `apps/client`, `apps/server`, Authoritative Simulation, Class Structure, Client Commands, Coordinate Frame, Deferred Tuning, Explosions (+21 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (30): addPenPoint(), boundsIntersect(), clamp(), clampBoundsToWorldBounds(), clampDeltaToWorldBounds(), clampPointToBounds(), clipboardItemsBounds(), distance() (+22 more)

### Community 10 - "Community 10"
Cohesion: 0.23
Nodes (3): LobbyDirectory, LobbyOccupant, LobbyRuntimeSnapshot

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (63): Camera, CanvasPoint, canvasToWorldWithCamera(), clampScale(), createBoundsKey(), fitCameraToBounds(), panCamera(), parseBoundsKey() (+55 more)

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (15): App(), AppProps, findLatestMatchEndedEvent(), GameActivity(), GameSessionPill(), LocalLobbyIdentity, LocalLobbyIdentityInput, resolveLocalLobbyIdentity() (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (59): allTerrainPointsInsideBounds(), eventToWorldPoint(), clamp(), clampToRange(), clampViewBoundsToMapBounds(), createViewBoxGeometry(), isPositiveFinite(), normalizedScreenPoint() (+51 more)

### Community 14 - "Community 14"
Cohesion: 0.05
Nodes (64): addUniqueT(), clampT(), collectSegmentRingIntersectionTs(), CollisionHit, CollisionSystem, compareCollisionOrder(), cross(), distance() (+56 more)

### Community 15 - "Community 15"
Cohesion: 0.21
Nodes (11): defaultSettings(), emptyState(), ensureGuild(), hasErrorCode(), LocalStateStore, nowIso(), PersistedGuildState, GuildSettings (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (12): collectEvents(), connect(), connectWithEvents(), createTempStateStore(), FailingMatchResultStore, servers, sockets, startTestServer() (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (20): Client State Shape, Create Lobby, Current State, Goals, Identity Model, Implementation Order, Join Lobby, Leaderboard And Persistent Stats (+12 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (23): devDependencies, concurrently, @playwright/test, tsx, @types/node, @types/ws, typescript, vite (+15 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (19): Execution Rules, File Structure, Graphwar Discord Activity Prototype Implementation Plan, Scope Check, Shared Type Names, Task 10: Client Session, Store, And Lobby UI, Task 11: Canvas Renderer And Server Event Animation, Task 12: Function Input Palette And Submit Flow (+11 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (13): createSessionFactory(), readClientSession(), readSourceFromHref(), SessionFactoryOptions, SessionSource, ClientSession, createLocalPlayerId(), LocalSessionStorage (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (13): DiscordUserId, GuildId, LobbyPlacementId, LobbySlot, AutoAssignTeamsCommand, CancelLobbyCommand, ForfeitMatchCommand, JoinRoomCommand (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (25): advancedSnippetButtons, clampPosition(), cursorInArgument(), CursorSelection, formatPlainExpression(), FunctionInput(), FunctionInputProps, mathCursor() (+17 more)

### Community 23 - "Community 23"
Cohesion: 0.21
Nodes (9): FunctionCreateOptions, FunctionRegistry, NormalFunction, SampleContext, ShotFunction, TrajectorySample, NormalFunctionParseOptions, ParsedNormalFunction (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (22): availableInitialSlots(), boundedFunctionLength(), createLobbyErrorMessage(), CreateLobbyForm, createLobbyInitialForm(), CreateLobbyView(), CreateLobbyViewProps, prepareCreateLobbyForm() (+14 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (12): ShotSubmissionEvents, autoAssignTeamsRequestSchema, createLobbyRequestSchema, joinLobbyRequestSchema, lobbyJoinResultSchema, lobbyRuntimeSnapshotSchema, lobbySummarySchema, setLobbyPlacementRequestSchema (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.11
Nodes (18): dependencies, electron, @graphwar/shared, react, react-dom, devDependencies, @types/react, @types/react-dom (+10 more)

### Community 28 - "Community 28"
Cohesion: 0.11
Nodes (17): dependencies, @discord/embedded-app-sdk, @graphwar/shared, react, react-dom, zod, zustand, devDependencies (+9 more)

### Community 29 - "Community 29"
Cohesion: 0.10
Nodes (19): Architecture Map, Client Menu, Lobby, Settings, Leaderboard, End-To-End Flow And Documentation, File Structure, Lobby Menu Flow Implementation Plan, Self-Review Checklist, Server Persistence And Lobby Runtime, Shared Contract (+11 more)

### Community 30 - "Community 30"
Cohesion: 0.23
Nodes (15): currentFileForSavedMap(), CurrentMapFile, editorStateFromSavedMap(), importMapFileForSave(), ImportMapFileResult, newMapNameError(), normalizeMapName(), parseSavedMapContents() (+7 more)

### Community 31 - "Community 31"
Cohesion: 0.16
Nodes (9): alice, bob, canvasPathPoints(), expectMenuCreateJoinNoScroll(), expectNoPageScroll(), fireMiss(), joinPopulatedLobbyWithoutScroll(), openLocalMenu() (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (10): ClientCreateLobbyRequest, ClientJoinLobbyRequest, errorMessageFromPayload(), readEmpty(), readJson(), guildSettingsSchema, playerStatsEntrySchema, CreateLobbyRequest (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (11): applyEventToSnapshot(), createGameState(), createGameStore(), CreateGameStoreOptions, GameClientFactory, GameLogEntry, GameStoreState, SelectedLobbySession (+3 more)

### Community 34 - "Community 34"
Cohesion: 0.20
Nodes (13): buildServer(), BuildServerOptions, defaultCorsAllowedOrigins, headerValue(), isMainModule(), parseRoomPath(), readConfiguredCorsOrigins(), rejectWebSocketUpgrade() (+5 more)

### Community 35 - "Community 35"
Cohesion: 0.12
Nodes (15): compilerOptions, baseUrl, isolatedModules, module, moduleResolution, noFallthroughCasesInSwitch, noUnusedLocals, noUnusedParameters (+7 more)

### Community 36 - "Community 36"
Cohesion: 0.13
Nodes (14): dependencies, expr-eval, fastify, @graphwar/shared, polygon-clipping, ws, zod, name (+6 more)

### Community 37 - "Community 37"
Cohesion: 0.22
Nodes (12): buildRoomWebSocketUrl(), BuildRoomWebSocketUrlOptions, connectGameClient(), GameClient, normalizeServerUrl(), readLocationHref(), readWebSocketConstructor(), Listener (+4 more)

### Community 38 - "Community 38"
Cohesion: 0.18
Nodes (10): LobbyDirectoryOptions, RuntimeLobby, Deferred, functionLengthBounds, isPlayerColor(), normalizeMaxFunctionLength(), normalizePlayerColor(), playerColorPalette (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.26
Nodes (15): addCircleTerrain(), addDefaultSpawnSet(), addRectangleTerrain(), addSpawnPoint(), addTriangleTerrain(), appendTerrainShape(), closePenShape(), fitTerrainPointsWithinBounds() (+7 more)

### Community 40 - "Community 40"
Cohesion: 0.18
Nodes (13): availableJoinSlots(), isAliasConflictError(), isJoinActionDisabled(), joinActionLabel(), JoinLobbyForm, JoinLobbyView(), JoinLobbyViewProps, prepareJoinLobbyForm() (+5 more)

### Community 41 - "Community 41"
Cohesion: 0.17
Nodes (11): avatarUrlSchema, craterRadiusSchema, damagePerHitSchema, dropUndefinedProperties(), inputModeSchema, lobbyOccupantSchema, lobbyStatusSchema, maxFunctionLengthSchema (+3 more)

### Community 42 - "Community 42"
Cohesion: 0.27
Nodes (10): createWindow(), listSavedMaps(), savedMapsDirectory(), SavedMapSummary, SaveMapPayload, slugify(), uniqueMapFilePath(), ApplicationMenuApi (+2 more)

### Community 43 - "Community 43"
Cohesion: 0.31
Nodes (9): groupActionLabels, groupMoveAction(), GroupMoveActionInput, inputModeLabel(), LobbySetupView(), LobbySetupViewProps, occupantsFor(), shouldConfirmLobbyCancellation() (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.17
Nodes (11): dependencies, expr-eval, polygon-clipping, zod, main, name, private, scripts (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.12
Nodes (16): Architecture Sketch, Client UI, Custom Maps And Map Maker Design, Electron Map Maker, Free-For-All Spawn Assignment, Goal, HTTP API, Lobby Integration (+8 more)

### Community 46 - "Community 46"
Cohesion: 0.25
Nodes (7): EditorClipboard, EditorSelection, EditorSelectionItem, EditorState, EditorTerrainShape, spawnClassName(), SpawnVisualState

### Community 47 - "Community 47"
Cohesion: 0.31
Nodes (8): formatMatchWinner(), MatchEndModal(), teamLabel(), freeForAllSnapshot, standardWorldBounds, teamSnapshot, WinnerText, MatchEndedEvent

### Community 48 - "useGameStore.test.ts"
Cohesion: 0.17
Nodes (7): Listener, playingSnapshot, session, snapshot, standardWorldBounds, ConnectGameClientOptions, LobbyApi

### Community 49 - "Community 49"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, jsx, lib, outDir, types, extends, include (+1 more)

### Community 51 - "Community 51"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, jsx, lib, noEmit, types, extends, include (+1 more)

### Community 52 - "Community 52"
Cohesion: 0.22
Nodes (8): compilerOptions, composite, outDir, rootDir, types, extends, include, references

### Community 54 - "Community 54"
Cohesion: 0.39
Nodes (6): cloneWorldBounds(), createEmptyEditorState(), toggleTeamSpawn(), exportEditorMap(), stringifyEditorMap(), stateWithTenSpawns()

### Community 55 - "Community 55"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, outDir, rootDir, types, extends, include

### Community 56 - "Community 56"
Cohesion: 0.25
Nodes (7): compilerOptions, composite, declaration, outDir, rootDir, extends, include

### Community 57 - "Community 57"
Cohesion: 0.29
Nodes (4): alice, bob, customMap, Player

### Community 60 - "Community 60"
Cohesion: 0.43
Nodes (4): aliasesConflict(), normalizeAlias(), JoinLobbyRequest, LobbyJoinResult

### Community 61 - "Community 61"
Cohesion: 0.18
Nodes (7): shooter, terrainArea(), defaultMatchTuning, fieldBounds, defaultFunctionValidationSettings, FunctionValidationSettings, InvalidFunctionBehavior

### Community 62 - "Community 62"
Cohesion: 0.50
Nodes (4): defaultLocalStateFilePath, createStore(), createTempDir(), tempDirs

### Community 63 - "Community 63"
Cohesion: 0.14
Nodes (13): Architecture, Damage, Data Flow, Error Handling, Friendly Fire, Gameplay Settings Phase 2 Design, Goal, Out Of Scope (+5 more)

### Community 64 - "Community 64"
Cohesion: 0.14
Nodes (13): Architecture, Avatar Rendering, Custom Maps, Data Flow, Default Map Generation, Error Handling, Goal, Map Maker (+5 more)

### Community 65 - "Community 65"
Cohesion: 0.17
Nodes (11): Commit Boundaries, Custom Maps And Map Maker Implementation Plan, File Structure, Final Review Checklist, Source Design, Task 1: Shared Custom Map Contract, Task 2: Server Persistence And HTTP Map API, Task 3: Lobby Selection And Custom Map Match Start (+3 more)

### Community 66 - "Community 66"
Cohesion: 0.18
Nodes (10): Advanced Normal Function Math Design, Architecture, Client Palette, Goal, Guardrails, Out Of Scope, Requirements, Semantics (+2 more)

### Community 77 - "Constants And Rules"
Cohesion: 0.20
Nodes (9): Advanced Normal Function Math Implementation Plan, Constants And Rules, File Structure, Self-Review, Task 1: Server Tests For Advanced Math, Task 2: Special Math Helpers, Task 3: Advanced Expression Compiler, Task 4: Client Math Palette (+1 more)

### Community 78 - "File Structure"
Cohesion: 0.22
Nodes (8): File Structure, Gameplay Settings Phase 2 Implementation Plan, Self-Review, Task 1: Shared Gameplay Setting Contracts, Task 2: Lobby Storage And Room Propagation, Task 3: Server Simulation Rules, Task 4: Client Create-Lobby And Lobby Setup UI, Task 5: Integration, E2E, And Final Verification

### Community 79 - "Lobby Identity And Settings Implementation Plan"
Cohesion: 0.22
Nodes (8): Commit Plan, File Structure, Lobby Identity And Settings Implementation Plan, Self-Review, Task 1: Shared Identity Contract, Task 2: Server Lobby And Simulation Propagation, Task 3: Client Lobby UX, Task 4: Game Rendering And E2E

### Community 80 - "File Structure"
Cohesion: 0.22
Nodes (8): File Structure, Map Presentation Camera Avatar Implementation Plan, Task 1: Shared Contracts, Task 2: Server Bounds Propagation, Task 3: Client Lobby And Avatar Identity Plumbing, Task 4: Canvas Camera And Avatar Rendering, Task 5: Map Maker Bounds Setup, Task 6: End-To-End Verification And Docs

### Community 81 - "Gameplay UI Fixes Design"
Cohesion: 0.22
Nodes (8): Client Design, Current Behavior, Gameplay UI Fixes Design, Main Menu Design, Recommended Approach, Scope, Server Design, Testing Plan

### Community 82 - "Lobby Identity And Settings Design"
Cohesion: 0.22
Nodes (8): Architecture, Data Flow, Error Handling, Goal, Lobby Identity And Settings Design, Requirements, Testing, UI Details

### Community 83 - "Graphwar / Graphwar II — Cheat Sheet"
Cohesion: 0.22
Nodes (8): 1. Core Rules & Field Parameters, 2. Allowed Function Components, 3. Game Modes (how your typed input becomes a shot), 4. Chat Commands (Player Actions), 5. Lobby Creation / Hosting / Networking, 6. Turn / Timer Mechanics, 7. Known Gaps / Where to Get Exact Answers, Graphwar / Graphwar II — Cheat Sheet

### Community 84 - "Graphwar Discord Activity"
Cohesion: 0.22
Nodes (8): Discord Direction, Features, Graphwar Discord Activity, Map Maker, Project Layout, Quick Start, Useful Commands, Verification

### Community 85 - "File Structure"
Cohesion: 0.25
Nodes (7): File Structure, Gameplay UI Fixes Implementation Plan, Task 1: Server Shot Sequencing And Length Limit, Task 2: Match-End Modal And Return-To-Menu State, Task 3: Client Playback Integration And E2E Coverage, Task 4: Main Menu And Modal Styling, Task 5: README, Full Verification, Commit, Push

### Community 86 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Global Constraints, Task 1: Turn timer protocol and lobby setting, Task 2: Input mode setting, keypad support, and live preview, Task 3: Requested UI cleanup, Task 4: Verification, docs, and delivery, Turn Timer And Function UI Plan

### Community 87 - "Aim Direction HUD Implementation Plan"
Cohesion: 0.33
Nodes (5): Aim Direction HUD Implementation Plan, Task 1: Shared Aim Direction Model, Task 2: Authoritative Server Rotation, Task 3: Client Direction Dial, Minimal HUD, Path Lifecycle, Task 4: Docs, Ignore, Verification, Push

### Community 88 - "AGENTS.md"
Cohesion: 0.50
Nodes (3): Graphify Workflow, Personal Preferences, UI Design Workflow

### Community 89 - "MatchHud.tsx"
Cohesion: 0.27
Nodes (8): CommandRejection, MatchHud(), MatchHudProps, phaseLabel(), remainingTurnSeconds(), playingSnapshot, session, standardWorldBounds

### Community 90 - "types.ts"
Cohesion: 0.22
Nodes (8): CustomMapFormat, CustomMapSpawnPoint, CustomMapTeamSpawnPointIds, CustomMapVersion, CustomMapWorldBounds, SaveCustomMapRequest, MapSizePreset, MapSizePresetId

### Community 91 - "DirectionDial.tsx"
Cohesion: 0.43
Nodes (5): DirectionDial(), DirectionDialProps, directionSymbols, nextAimDirection(), aimDirections

### Community 92 - "LobbyPanel.tsx"
Cohesion: 0.40
Nodes (5): ConnectionStatus, LobbyPanel(), LobbyPanelProps, modeOptions, playerLabel()

### Community 93 - "MapLibraryView.tsx"
Cohesion: 0.40
Nodes (4): MapLibraryView(), MapLibraryViewProps, map, CustomMapSummary

### Community 94 - "lobbyApi.test.ts"
Cohesion: 0.40
Nodes (3): customMap, customMapSummary, persistedCustomMap

## Knowledge Gaps
- **544 isolated node(s):** `Player`, `alice`, `bob`, `customMap`, `Player` (+539 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorldPoint` connect `Community 14` to `Community 0`, `Community 5`, `Community 7`, `Community 9`, `Community 11`, `Community 13`, `Community 46`, `types.ts`, `Community 61`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `RecordingCanvasContext` connect `Community 26` to `Community 11`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `LobbyDirectory` connect `Community 10` to `Community 1`, `Community 34`, `Community 38`, `Community 40`, `Community 16`, `Community 21`, `Community 24`, `Community 60`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `Player`, `alice`, `bob` to the rest of the system?**
  _544 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07783783783783783 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11989795918367346 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08792270531400966 - nodes in this community are weakly interconnected._