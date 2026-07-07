import { normalizeTerrainState, validateCustomMapImportForSave, type CustomMapImport } from "@graphwar/shared";
import type { EditorState } from "./editorTypes";

export function exportEditorMap(state: EditorState): CustomMapImport {
  const map: CustomMapImport = {
    format: "graphwar-map",
    version: 1,
    name: state.mapName.trim(),
    worldBounds: { ...state.worldBounds },
    terrain: normalizeTerrainState({
      blobs: state.terrainShapes.map((shape) => ({
        id: shape.id,
        outer: shape.points,
        holes: []
      }))
    }),
    spawnPoints: state.spawnPoints.map((spawn) => ({
      id: spawn.id,
      position: spawn.position
    })),
    teamSpawnPointIds: {
      "team-a": state.teamSpawnPointIds["team-a"],
      "team-b": state.teamSpawnPointIds["team-b"]
    }
  };

  return validateCustomMapImportForSave(map);
}

export function stringifyEditorMap(state: EditorState): string {
  return `${JSON.stringify(exportEditorMap(state), null, 2)}\n`;
}
