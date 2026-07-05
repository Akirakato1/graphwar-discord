import { describe, expect, it } from "vitest";
import { addRectangleTerrain, addSpawnPoint, createEmptyEditorState, toggleTeamSpawn } from "./editorModel";
import { exportEditorMap, stringifyEditorMap } from "./mapExport";

function stateWithTenSpawns() {
  let state = createEmptyEditorState();
  for (let index = 0; index < 10; index += 1) {
    state = addSpawnPoint(state, { x: index < 5 ? -18 : 18, y: -8 + (index % 5) * 4 });
  }
  return state;
}

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

  it("blocks export with fewer than ten spawn points", () => {
    expect(() => exportEditorMap(createEmptyEditorState())).toThrow("at least 10 spawn points");
  });

  it("serializes valid maps with a trailing newline for file export", () => {
    const json = stringifyEditorMap(stateWithTenSpawns());
    expect(JSON.parse(json).format).toBe("graphwar-map");
    expect(json.endsWith("\n")).toBe(true);
  });
});
