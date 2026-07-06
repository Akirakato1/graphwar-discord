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
  createEmptyEditorState,
  moveSelected,
  removeMostRecentPenPoint,
  resizeSelectedTerrain,
  selectAtPoint,
  toggleTeamSpawn
} from "./editorModel";

describe("editorModel", () => {
  it("stores custom map name and world bounds when creating an empty editor state", () => {
    const worldBounds = worldBoundsForMapSize("huge");

    const state = createEmptyEditorState({ mapName: "Huge Arena", worldBounds });

    expect(state.mapName).toBe("Huge Arena");
    expect(state.worldBounds).toEqual(worldBounds);
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
