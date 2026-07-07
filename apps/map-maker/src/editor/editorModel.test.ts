import { isWorldPointInBounds, worldBoundsForMapSize } from "@graphwar/shared";
import { describe, expect, it } from "vitest";
import {
  addDefaultSpawnSet,
  addCircleTerrain,
  addPenPoint,
  addRectangleTerrain,
  addSpawnPoint,
  addTriangleTerrain,
  closePenShape,
  copySelected,
  createEmptyEditorState,
  moveSelected,
  pasteClipboard,
  removeMostRecentPenPoint,
  resizeSelectedTerrain,
  selectAtPoint,
  selectItemsInBounds,
  toggleSelectedItem,
  toggleTeamSpawn
} from "./editorModel";

describe("editorModel", () => {
  function allTerrainPointsInsideBounds(state: ReturnType<typeof createEmptyEditorState>): boolean {
    return state.terrainShapes.every((shape) =>
      shape.points.every((point) => isWorldPointInBounds(point, state.worldBounds))
    );
  }

  it("stores custom map name and world bounds when creating an empty editor state", () => {
    const worldBounds = worldBoundsForMapSize("huge");

    const state = createEmptyEditorState({ mapName: "Huge Arena", worldBounds });

    expect(state.mapName).toBe("Huge Arena");
    expect(state.worldBounds).toEqual(worldBounds);
  });

  it("defaults new editor maps to an empty name", () => {
    expect(createEmptyEditorState().mapName).toBe("");
  });

  it("adds common terrain shapes and selects the newest shape", () => {
    let state = createEmptyEditorState();

    state = addRectangleTerrain(state, { x: 0, y: 0 }, 8, 4);
    state = addTriangleTerrain(state, { x: 10, y: 0 }, 6, 6);
    state = addCircleTerrain(state, { x: -10, y: 0 }, 3, 12);

    expect(state.terrainShapes).toHaveLength(3);
    expect(state.terrainShapes[0].points).toHaveLength(4);
    expect(state.terrainShapes[1].points).toHaveLength(3);
    expect(state.terrainShapes[2].points).toHaveLength(12);
    expect(state.selection).toEqual({ type: "terrain", id: state.terrainShapes[2].id });
  });

  it("creates and undoes pen points before closing a custom polygon", () => {
    let state = createEmptyEditorState();
    state = addPenPoint(state, { x: 0, y: 0 });
    state = addPenPoint(state, { x: 4, y: 0 });
    state = addPenPoint(state, { x: 4, y: 4 });
    state = removeMostRecentPenPoint(state);
    state = addPenPoint(state, { x: 0, y: 4 });
    state = closePenShape(state);

    expect(state.penPoints).toHaveLength(0);
    expect(state.terrainShapes).toHaveLength(1);
    expect(state.terrainShapes[0].points).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 4 }
    ]);
  });

  it("moves selected terrain and spawn points", () => {
    let state = createEmptyEditorState();
    state = addRectangleTerrain(state, { x: 0, y: 0 }, 4, 2);
    state = moveSelected(state, { x: 3, y: -1 });
    expect(state.terrainShapes[0].points[0]).toEqual({ x: 1, y: -2 });

    state = addSpawnPoint(state, { x: 1, y: 2 });
    state = moveSelected(state, { x: -2, y: 3 });
    expect(state.spawnPoints[0].position).toEqual({ x: -1, y: 5 });
  });

  it("resizes selected terrain from a transform bounding box", () => {
    let state = createEmptyEditorState();
    state = addRectangleTerrain(state, { x: 0, y: 0 }, 4, 2);
    state = resizeSelectedTerrain(state, { minX: -4, maxX: 4, minY: -1, maxY: 3 });

    expect(state.terrainShapes[0].points).toEqual([
      { x: -4, y: -1 },
      { x: 4, y: -1 },
      { x: 4, y: 3 },
      { x: -4, y: 3 }
    ]);
  });

  it("clamps newly placed terrain and spawns inside the map bounds", () => {
    const bounds = worldBoundsForMapSize("small");
    let state = createEmptyEditorState({ worldBounds: bounds });

    state = addRectangleTerrain(state, { x: bounds.maxX, y: bounds.maxY }, 8, 4);
    state = addSpawnPoint(state, { x: bounds.maxX + 10, y: bounds.minY - 10 });

    expect(allTerrainPointsInsideBounds(state)).toBe(true);
    expect(isWorldPointInBounds(state.spawnPoints[0].position, bounds)).toBe(true);
    expect(state.spawnPoints[0].position).toEqual({ x: bounds.maxX, y: bounds.minY });
  });

  it("sanitizes non-finite pointer positions before adding terrain and spawns", () => {
    const bounds = worldBoundsForMapSize("small");
    let state = createEmptyEditorState({ worldBounds: bounds });

    state = addRectangleTerrain(state, { x: Number.NaN, y: Number.POSITIVE_INFINITY }, 8, 4);
    state = addSpawnPoint(state, { x: Number.NEGATIVE_INFINITY, y: Number.NaN });

    expect(allTerrainPointsInsideBounds(state)).toBe(true);
    expect(isWorldPointInBounds(state.spawnPoints[0].position, bounds)).toBe(true);
  });

  it("keeps moved and resized selections inside the map bounds", () => {
    const bounds = worldBoundsForMapSize("small");
    let state = createEmptyEditorState({ worldBounds: bounds });

    state = addRectangleTerrain(state, { x: 0, y: 0 }, 8, 4);
    state = moveSelected(state, { x: 100, y: 100 });
    expect(allTerrainPointsInsideBounds(state)).toBe(true);

    state = resizeSelectedTerrain(state, {
      minX: bounds.minX - 20,
      maxX: bounds.maxX + 20,
      minY: bounds.minY - 20,
      maxY: bounds.maxY + 20
    });
    expect(allTerrainPointsInsideBounds(state)).toBe(true);

    state = addSpawnPoint(state, { x: 0, y: 0 });
    state = moveSelected(state, { x: -100, y: -100 });
    expect(state.spawnPoints[0].position).toEqual({ x: bounds.minX, y: bounds.minY });
  });

  it("clamps pen points and closed pen terrain inside the map bounds", () => {
    const bounds = worldBoundsForMapSize("small");
    let state = createEmptyEditorState({ worldBounds: bounds });

    state = addPenPoint(state, { x: bounds.minX - 4, y: bounds.maxY + 4 });
    state = addPenPoint(state, { x: bounds.maxX + 4, y: bounds.maxY + 4 });
    state = addPenPoint(state, { x: 0, y: bounds.minY - 4 });
    state = closePenShape(state);

    expect(state.penPoints).toHaveLength(0);
    expect(allTerrainPointsInsideBounds(state)).toBe(true);
  });

  it("keeps a spawn in only one team subset at a time", () => {
    let state = createEmptyEditorState();
    state = addSpawnPoint(state, { x: 0, y: 0 });

    state = toggleTeamSpawn(state, state.spawnPoints[0].id, "team-a");
    state = toggleTeamSpawn(state, state.spawnPoints[0].id, "team-b");

    expect(state.teamSpawnPointIds["team-a"]).toEqual([]);
    expect(state.teamSpawnPointIds["team-b"]).toEqual([state.spawnPoints[0].id]);
  });

  it("selects nearby spawn points before terrain under the cursor", () => {
    let state = createEmptyEditorState();
    state = addRectangleTerrain(state, { x: 0, y: 0 }, 10, 10);
    state = addSpawnPoint(state, { x: 1, y: 1 });

    state = selectAtPoint(state, { x: 1.2, y: 1.1 });
    expect(state.selection).toEqual({ type: "spawn", id: state.spawnPoints[0].id });
  });

  it("selects terrain and spawn points inside a marquee bounds", () => {
    let state = createEmptyEditorState();
    state = addRectangleTerrain(state, { x: 0, y: 0 }, 4, 4);
    const terrainId = state.terrainShapes[0].id;
    state = addSpawnPoint(state, { x: 8, y: 2 });
    const spawnId = state.spawnPoints[0].id;
    state = addRectangleTerrain(state, { x: 20, y: 20 }, 4, 4);

    state = selectItemsInBounds(state, { minX: -3, maxX: 9, minY: -3, maxY: 3 });

    expect(state.selection).toEqual({
      type: "multi",
      items: [
        { type: "terrain", id: terrainId },
        { type: "spawn", id: spawnId }
      ]
    });
  });

  it("toggles items out of and into a multi-selection", () => {
    let state = createEmptyEditorState();
    state = addRectangleTerrain(state, { x: 0, y: 0 }, 4, 4);
    const terrainId = state.terrainShapes[0].id;
    state = addSpawnPoint(state, { x: 8, y: 2 });
    const spawnId = state.spawnPoints[0].id;
    state = selectItemsInBounds(state, { minX: -3, maxX: 9, minY: -3, maxY: 3 });

    state = toggleSelectedItem(state, { type: "spawn", id: spawnId });
    expect(state.selection).toEqual({ type: "terrain", id: terrainId });

    state = toggleSelectedItem(state, { type: "spawn", id: spawnId });
    expect(state.selection).toEqual({
      type: "multi",
      items: [
        { type: "terrain", id: terrainId },
        { type: "spawn", id: spawnId }
      ]
    });
  });

  it("moves all selected terrain and spawn points as a group", () => {
    let state = createEmptyEditorState();
    state = addRectangleTerrain(state, { x: 0, y: 0 }, 4, 4);
    state = addSpawnPoint(state, { x: 8, y: 2 });
    state = selectItemsInBounds(state, { minX: -3, maxX: 9, minY: -3, maxY: 3 });

    state = moveSelected(state, { x: 2, y: 3 });

    expect(state.terrainShapes[0].points).toEqual([
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 5 },
      { x: 0, y: 5 }
    ]);
    expect(state.spawnPoints[0].position).toEqual({ x: 10, y: 5 });
  });

  it("copies and pastes selected terrain and spawns while preserving spawn teams", () => {
    let state = createEmptyEditorState();
    state = addRectangleTerrain(state, { x: 0, y: 0 }, 4, 4);
    const sourceTerrainId = state.terrainShapes[0].id;
    state = addSpawnPoint(state, { x: 8, y: 2 });
    const sourceSpawnId = state.spawnPoints[0].id;
    state = toggleTeamSpawn(state, sourceSpawnId, "team-a");
    state = selectItemsInBounds(state, { minX: -3, maxX: 9, minY: -3, maxY: 3 });

    const clipboard = copySelected(state);
    expect(clipboard).not.toBeNull();
    state = pasteClipboard(state, clipboard, { x: 2, y: -2 });

    expect(state.terrainShapes).toHaveLength(2);
    expect(state.spawnPoints).toHaveLength(2);
    expect(state.terrainShapes[1].id).not.toBe(sourceTerrainId);
    expect(state.terrainShapes[1].points).toEqual([
      { x: 0, y: -4 },
      { x: 4, y: -4 },
      { x: 4, y: 0 },
      { x: 0, y: 0 }
    ]);
    expect(state.spawnPoints[1]).toEqual({
      id: "spawn-2",
      position: { x: 10, y: 0 }
    });
    expect(state.teamSpawnPointIds["team-a"]).toEqual([sourceSpawnId, "spawn-2"]);
    expect(state.selection).toEqual({
      type: "multi",
      items: [
        { type: "terrain", id: state.terrainShapes[1].id },
        { type: "spawn", id: "spawn-2" }
      ]
    });
  });

  it("adds a default 10-spawn set inside the active bounds with 5v5 team subsets", () => {
    const state = addDefaultSpawnSet(createEmptyEditorState({ worldBounds: worldBoundsForMapSize("huge") }));

    expect(state.spawnPoints).toHaveLength(10);
    expect(state.spawnPoints.every((spawn) => isWorldPointInBounds(spawn.position, state.worldBounds))).toBe(true);
    expect(state.teamSpawnPointIds["team-a"]).toHaveLength(5);
    expect(state.teamSpawnPointIds["team-b"]).toHaveLength(5);
    expect(new Set(state.teamSpawnPointIds["team-a"]).size).toBe(5);
    expect(new Set(state.teamSpawnPointIds["team-b"]).size).toBe(5);
  });

  it("preserves existing spawns and team assignments when appending the default spawn set", () => {
    let state = createEmptyEditorState({ worldBounds: worldBoundsForMapSize("huge") });
    state = addSpawnPoint(state, { x: -3, y: 4 });
    state = toggleTeamSpawn(state, state.spawnPoints[0].id, "team-a");

    state = addDefaultSpawnSet(state);

    expect(state.spawnPoints).toHaveLength(11);
    expect(state.spawnPoints[0]).toEqual({
      id: "spawn-1",
      position: { x: -3, y: 4 }
    });
    expect(new Set(state.spawnPoints.map((spawn) => spawn.id)).size).toBe(11);
    expect(state.teamSpawnPointIds["team-a"]).toHaveLength(6);
    expect(state.teamSpawnPointIds["team-a"][0]).toBe("spawn-1");
    expect(state.teamSpawnPointIds["team-b"]).toHaveLength(5);
  });
});
