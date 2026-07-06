import { worldBoundsForMapSize } from "@graphwar/shared";
import { describe, expect, it } from "vitest";
import { addRectangleTerrain, addSpawnPoint, createEmptyEditorState, toggleTeamSpawn } from "./editorModel";
import { exportEditorMap, stringifyEditorMap } from "./mapExport";

describe("mapExport", () => {
  it("exports editor terrain and spawns as graphwar map JSON", () => {
    let state = stateWithTenSpawns();
    state = { ...state, mapName: "Moon Arena" };
    state = addRectangleTerrain(state, { x: 0, y: 0 }, 4, 2);
    state = toggleTeamSpawn(state, state.spawnPoints[0].id, "team-a");
    state = toggleTeamSpawn(state, state.spawnPoints[5].id, "team-b");

    const exported = exportEditorMap(state);
    expect(exported).toMatchObject({
      format: "graphwar-map",
      version: 1,
      name: "Moon Arena"
    });
    expect(exported.terrain.blobs).toHaveLength(1);
    expect(exported.spawnPoints).toHaveLength(10);
  });

  it("exports selected world bounds with the saved custom map", () => {
    const worldBounds = worldBoundsForMapSize("huge");
    const exported = exportEditorMap(stateWithTenSpawns({ mapName: "Huge Arena", worldBounds }));

    expect(exported.worldBounds).toEqual(worldBounds);
  });

  it("blocks export with fewer than ten spawn points", () => {
    expect(() => exportEditorMap(createEmptyEditorState())).toThrow("at least 10 spawn points");
  });

  it("blocks export when editor content falls outside the selected world bounds", () => {
    let state = stateWithTenSpawns({ worldBounds: worldBoundsForMapSize("small") });
    state = addSpawnPoint(state, { x: 21, y: 0 });

    expect(() => exportEditorMap(state)).toThrow("Custom map content must stay inside world bounds.");
  });

  it("serializes valid maps with a trailing newline for file export", () => {
    const json = stringifyEditorMap(stateWithTenSpawns({ worldBounds: worldBoundsForMapSize("large") }));
    const parsed = JSON.parse(json);

    expect(parsed.format).toBe("graphwar-map");
    expect(parsed.worldBounds).toEqual(worldBoundsForMapSize("large"));
    expect(json.endsWith("\n")).toBe(true);
  });
});

function stateWithTenSpawns(options?: { mapName?: string; worldBounds?: ReturnType<typeof worldBoundsForMapSize> }) {
  let state = createEmptyEditorState(options);
  for (let index = 0; index < 10; index += 1) {
    state = addSpawnPoint(state, { x: index < 5 ? -18 : 18, y: -8 + (index % 5) * 4 });
  }
  return state;
}
