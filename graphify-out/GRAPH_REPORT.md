# Graph Report - Graphwar Discord Activity  (2026-07-10)

## Corpus Check
- 193 files · ~138,659 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1687 nodes · 3654 edges · 104 communities (92 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `93963e3d`
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
- ShotSimulator.ts
- Community 54
- Community 55
- Community 56
- Community 57
- normalizeTerrain.ts
- SpawnSafety.ts
- Community 60
- useGameStore.test.ts
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
- MapGenerator.test.ts
- Global Constraints
- FakeWebSocket
- MapLibraryView.tsx
- FakeWebSocket
- DirectionDial.tsx
- SettingsView.tsx
- LobbyPanel.tsx
- ShotSimulator.ts
- LeaderboardView.tsx
- MemoryStorage
- LocalStateStore.maps.test.ts
- MainMenu.tsx
- gameAudio.ts

## God Nodes (most connected - your core abstractions)
1. `WorldPoint` - 44 edges
2. `GameRoom` - 40 edges
3. `LobbyDirectory` - 37 edges
4. `MatchController` - 34 edges
5. `PlayerId` - 34 edges
6. `WorldBounds` - 28 edges
7. `MatchModeId` - 26 edges
8. `App()` - 25 edges
9. `ShotSimulator` - 25 edges
10. `ServerEvent` - 25 edges

## Surprising Connections (you probably didn't know these)
- `fitCameraToBounds()` --calls--> `boundsHeight()`  [EXTRACTED]
  apps/client/src/game-renderer/camera.ts → packages/shared/src/maps/worldBounds.ts
- `fitCameraToBounds()` --calls--> `boundsWidth()`  [EXTRACTED]
  apps/client/src/game-renderer/camera.ts → packages/shared/src/maps/worldBounds.ts
- `computeFunctionPreview()` --calls--> `parseNormalFunction()`  [EXTRACTED]
  apps/client/src/game-renderer/functionPreview.ts → packages/shared/src/functions/normalFunction.ts
- `parseCustomMapFileText()` --calls--> `validateCustomMapImportForSave()`  [EXTRACTED]
  apps/client/src/maps/mapFile.ts → packages/shared/src/maps/schemas.ts
- `allTerrainPointsInsideBounds()` --calls--> `isWorldPointInBounds()`  [EXTRACTED]
  apps/map-maker/src/editor/editorModel.test.ts → packages/shared/src/maps/worldBounds.ts

## Import Cycles
- None detected.

## Communities (104 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (60): FunctionCreateOptions, FunctionRegistry, NormalFunction, SampleContext, ShotFunction, TrajectorySample, FreeForAllMapGenerator, roundToTwoDecimals() (+52 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (39): impactLabel(), shotHistoryEntriesFromEvents(), ShotHistoryEntry, ShotHistoryTab(), ShotHistoryTabProps, snapshot, LobbySessionIdentity, parseCommand() (+31 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (43): advancedFunctionSymbols, assertAdvancedFunctionsAllowed(), baseFunctionSymbols, baseValueSymbols, canEndFactor(), canStartFactor(), compileDerivative(), CompiledNormalExpression (+35 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (19): allTerrainPointsInsideBounds(), customMapImportSchema, customMapSpawnPointSchema, customMapTeamSpawnPointIdsSchema, customMapTerrainBlobSchema, customMapTerrainRingSchema, customMapTerrainStateSchema, mapNameSchema (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (23): craterRadiusBounds, damagePerHitBounds, inputModes, LobbyGameplaySettings, turnDurationSecondsBounds, autoAssignTeamsRequestSchema, craterRadiusSchema, createLobbyRequestSchema (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (23): boundsFromHandle(), customDimensionLimits, defaultCanvasSize, DragState, gridValues(), normalizeBounds(), normalizedDimension(), ResizeHandle (+15 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (48): advancedFunctionSymbols, assertAdvancedFunctionsAllowed(), baseFunctionSymbols, baseValueSymbols, canEndFactor(), canStartFactor(), compileDerivative(), CompiledNormalExpression (+40 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (11): computeFunctionPreview(), distance(), FunctionPreviewInput, resolveMaxFunctionLength(), snapshot, truncatePathByDistance(), directionVector(), localToWorld() (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (29): `apps/client`, `apps/server`, Authoritative Simulation, Class Structure, Client Commands, Coordinate Frame, Deferred Tuning, Explosions (+21 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (29): boundsIntersect(), clamp(), clampBoundsToWorldBounds(), clipboardItemsBounds(), distance(), expandBoundsIfNeeded(), getTerrainBounds(), isBounds() (+21 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (8): LobbyDirectory, aliasesConflict(), normalizeAlias(), JoinLobbyRequest, LobbyJoinResult, LobbyOccupant, LobbyPlacementId, LobbyRuntimeSnapshot

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (61): Camera, CanvasPoint, canvasToWorldWithCamera(), clampScale(), createBoundsKey(), fitCameraToBounds(), panCamera(), parseBoundsKey() (+53 more)

### Community 12 - "Community 12"
Cohesion: 0.19
Nodes (14): App(), AppProps, findLatestMatchEndedEvent(), GameActivity(), GameSessionPill(), LocalLobbyIdentity, LocalLobbyIdentityInput, resolveLocalLobbyIdentity() (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.32
Nodes (16): eventToWorldPoint(), clamp(), clampToRange(), clampViewBoundsToMapBounds(), createViewBoxGeometry(), isPositiveFinite(), normalizedScreenPoint(), panViewBoundsByScreenDelta() (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.24
Nodes (4): CollisionHit, ShotSimulator, WorldPoint, WorldBounds

### Community 15 - "Community 15"
Cohesion: 0.22
Nodes (10): defaultSettings(), emptyState(), ensureGuild(), hasErrorCode(), LocalStateStore, nowIso(), PersistedGuildState, GuildSettings (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (13): collectEvents(), connect(), connectWithEvents(), createTempStateStore(), FailingMatchResultStore, servers, sockets, startGraceTestServer() (+5 more)

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
Cohesion: 0.19
Nodes (11): createSessionFactory(), readClientSession(), readSourceFromHref(), SessionFactoryOptions, SessionSource, ClientSession, createLocalPlayerId(), LocalSessionStorage (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (20): FunctionDraftState, RuntimeLobby, defaultLobbyGameplaySettings, FunctionInputMode, PlayerColor, AutoAssignTeamsRequest, CreateLobbyRequest, DiscordUserId (+12 more)

### Community 22 - "Community 22"
Cohesion: 0.10
Nodes (35): advancedSnippetButtons, argumentStartsInCall(), clampPosition(), cursorInArgument(), CursorSelection, formatPlainExpression(), FunctionInput(), FunctionInputProps (+27 more)

### Community 23 - "Community 23"
Cohesion: 0.10
Nodes (19): ShotSubmissionEvents, avatarUrlInputSchema, avatarUrlSchema, lobbyPlacementSchema, lobbySlotSchema, matchModeSchema, playerColorSchema, aimDirectionSchema (+11 more)

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (12): availableInitialSlots(), boundedFunctionLength(), createLobbyErrorMessage(), CreateLobbyForm, createLobbyInitialForm(), CreateLobbyView(), CreateLobbyViewProps, prepareCreateLobbyForm() (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (15): terrainArea(), CircleCraterExplosion, Explosion, ExplosionApplyOptions, ExplosionResult, blobToMultiPolygon(), effectiveBlobArea(), pointsToRing() (+7 more)

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
Cohesion: 0.24
Nodes (17): addUniqueT(), clampT(), collectSegmentRingIntersectionTs(), CollisionSystem, compareCollisionOrder(), cross(), distance(), dot() (+9 more)

### Community 31 - "Community 31"
Cohesion: 0.16
Nodes (11): alice, bob, canvasPathPoints(), expectMenuCreateJoinNoScroll(), expectNoPageScroll(), fireMiss(), joinLobby(), joinPopulatedLobbyWithoutScroll() (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.20
Nodes (11): ClientCreateLobbyRequest, ClientJoinLobbyRequest, errorMessageFromPayload(), readEmpty(), readJson(), guildSettingsSchema, lobbyJoinResultSchema, lobbySummarySchema (+3 more)

### Community 33 - "Community 33"
Cohesion: 0.16
Nodes (13): PersistedSelectedLobbySession, readBrowserLobbySessionStorage(), applyEventToSnapshot(), createGameState(), createGameStore(), CreateGameStoreOptions, GameClientFactory, GameLogEntry (+5 more)

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
Cohesion: 0.20
Nodes (13): buildRoomWebSocketUrl(), BuildRoomWebSocketUrlOptions, connectGameClient(), ConnectGameClientOptions, GameClient, normalizeServerUrl(), readLocationHref(), readWebSocketConstructor() (+5 more)

### Community 38 - "Community 38"
Cohesion: 0.21
Nodes (8): LobbyDirectoryOptions, Deferred, functionLengthBounds, isPlayerColor(), normalizeMaxFunctionLength(), normalizePlayerColor(), playerColorPalette, playerColors

### Community 39 - "Community 39"
Cohesion: 0.19
Nodes (22): addCircleTerrain(), addDefaultSpawnSet(), addPenPoint(), addRectangleTerrain(), addSpawnPoint(), addTriangleTerrain(), appendTerrainShape(), clampDeltaToWorldBounds() (+14 more)

### Community 40 - "Community 40"
Cohesion: 0.28
Nodes (10): availableJoinSlots(), isAliasConflictError(), isJoinActionDisabled(), joinActionLabel(), JoinLobbyForm, JoinLobbyView(), JoinLobbyViewProps, prepareJoinLobbyForm() (+2 more)

### Community 41 - "Community 41"
Cohesion: 0.23
Nodes (15): currentFileForSavedMap(), CurrentMapFile, editorStateFromSavedMap(), importMapFileForSave(), ImportMapFileResult, newMapNameError(), normalizeMapName(), parseSavedMapContents() (+7 more)

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
Cohesion: 0.14
Nodes (17): copySelected(), deleteSelected(), isItemSelected(), selectedItems(), EditorState, App(), boundsFromPoints(), boundsLabel() (+9 more)

### Community 47 - "Community 47"
Cohesion: 0.31
Nodes (8): formatMatchWinner(), MatchEndModal(), teamLabel(), freeForAllSnapshot, standardWorldBounds, teamSnapshot, WinnerText, MatchEndedEvent

### Community 48 - "useGameStore.test.ts"
Cohesion: 0.24
Nodes (10): CustomMapSpawner, CustomMapSpawnPlayer, deriveBoundsFromTerrainAndSpawns(), distanceSquared(), padBounds(), pointBounds(), teamSpawnLabels, terrainPoints() (+2 more)

### Community 49 - "Community 49"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, jsx, lib, outDir, types, extends, include (+1 more)

### Community 51 - "Community 51"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, jsx, lib, noEmit, types, extends, include (+1 more)

### Community 52 - "Community 52"
Cohesion: 0.22
Nodes (8): compilerOptions, composite, outDir, rootDir, types, extends, include, references

### Community 53 - "ShotSimulator.ts"
Cohesion: 0.15
Nodes (10): PlayerCollisionHit, distance(), interpolate(), ResolvedImpact, samePoint(), ShotSimulationInput, ShotSimulationResult, shooter (+2 more)

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
Cohesion: 0.25
Nodes (4): alice, bob, customMap, Player

### Community 58 - "normalizeTerrain.ts"
Cohesion: 0.22
Nodes (12): isPointInBounds(), makeCirclePolygon(), LocalPoint, PolygonRing, TerrainBlob, blobToMultiPolygon(), cloneTerrain(), effectiveBlobArea() (+4 more)

### Community 59 - "SpawnSafety.ts"
Cohesion: 0.29
Nodes (13): distanceToRing(), distanceToSegment(), isPointClearOfTerrain(), isPointInTerrain(), nudgeSpawnOutsideTerrain(), pointInBlob(), pointInRing(), pointOnSegment() (+5 more)

### Community 60 - "Community 60"
Cohesion: 0.27
Nodes (10): clearSelectedLobbySession(), isPersistedSelectedLobbySession(), isRecord(), LobbySessionScope, LobbySessionStorage, readSelectedLobbySession(), saveSelectedLobbySession(), selectedLobbySessionKey() (+2 more)

### Community 61 - "useGameStore.test.ts"
Cohesion: 0.17
Nodes (6): Listener, playingSnapshot, session, snapshot, standardWorldBounds, LobbyApi

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
Nodes (9): CommandRejection, MatchHud(), MatchHudProps, phaseLabel(), remainingTurnSeconds(), soundCueForTurnTimer(), playingSnapshot, session (+1 more)

### Community 90 - "MapGenerator.test.ts"
Cohesion: 0.36
Nodes (8): distanceToRing(), distanceToSegment(), distanceToTerrain(), pointInBlob(), pointInRing(), pointOnSegment(), terrainAtPoint(), mapSizePresetIds

### Community 91 - "Global Constraints"
Cohesion: 0.22
Nodes (8): Global Constraints, Resume Disconnect Lobby Join Implementation Plan, Self-Review, Task 1: Shared Protocol For Private Function Drafts, Task 2: Server Disconnect Grace And Draft Store, Task 3: Client Session Persistence And Draft Sync, Task 4: Join Lobby Row UI And Disconnected UX, Task 5: Full Verification, Docs, Graphify, Push

### Community 93 - "MapLibraryView.tsx"
Cohesion: 0.40
Nodes (4): MapLibraryView(), MapLibraryViewProps, map, CustomMapSummary

### Community 95 - "DirectionDial.tsx"
Cohesion: 0.43
Nodes (5): DirectionDial(), DirectionDialProps, directionSymbols, nextAimDirection(), aimDirections

### Community 97 - "LobbyPanel.tsx"
Cohesion: 0.40
Nodes (5): ConnectionStatus, LobbyPanel(), LobbyPanelProps, modeOptions, playerLabel()

### Community 98 - "ShotSimulator.ts"
Cohesion: 0.40
Nodes (3): customMap, customMapSummary, persistedCustomMap

### Community 102 - "MainMenu.tsx"
Cohesion: 0.29
Nodes (6): AppView, EquationProjectile, equationProjectiles, equationTemplates, MainMenu(), MainMenuProps

### Community 103 - "gameAudio.ts"
Cohesion: 0.16
Nodes (12): ButtonSoundBoundary(), ButtonSoundBoundaryProps, buttonFromEventTarget(), knownButtonSoundIds, ReleasedButtonSoundInput, soundIdForReleasedButton(), soundIdsForServerEvent(), BrowserAudioWindow (+4 more)

## Knowledge Gaps
- **567 isolated node(s):** `Player`, `alice`, `bob`, `customMap`, `Player` (+562 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorldPoint` connect `Community 14` to `Community 0`, `Community 1`, `normalizeTerrain.ts`, `Community 5`, `Community 7`, `Community 9`, `Community 11`, `Community 13`, `useGameStore.test.ts`, `ShotSimulator.ts`, `Community 21`, `Community 25`, `MapGenerator.test.ts`, `SpawnSafety.ts`, `Community 30`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `WorldBounds` connect `Community 14` to `Community 0`, `Community 3`, `Community 5`, `Community 9`, `Community 11`, `Community 13`, `useGameStore.test.ts`, `ShotSimulator.ts`, `Community 21`, `SpawnSafety.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `LobbyDirectory` connect `Community 10` to `Community 1`, `Community 34`, `Community 38`, `Community 16`, `Community 21`, `Community 24`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `Player`, `alice`, `bob` to the rest of the system?**
  _567 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0502679994205418 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05590386624869383 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08603145235892692 - nodes in this community are weakly interconnected._