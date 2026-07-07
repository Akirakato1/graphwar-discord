import {
  defaultMapSizePreset,
  validateCustomMapImportForSave,
  worldBoundsForMapSize,
  type CustomMapImport
} from "@graphwar/shared";
import type { EditorState } from "../editor/editorTypes";

export type SavedMapSummary = {
  filePath: string;
  name: string;
  updatedAt?: string;
};

export type CurrentMapFile = {
  filePath: string;
  savedMapName: string;
};

export type SaveMapRequest = {
  contents: string;
  filePath?: string;
  mapName: string;
};

export type ImportMapFileResult =
  | {
      error: string;
    }
  | {
      map: CustomMapImport;
      request: SaveMapRequest;
    };

export const fileApiUnavailableMessage = "Map maker file API unavailable. Launch with npm run dev:map-maker.";

export function normalizeMapName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function currentFileForSavedMap(savedMap: SavedMapSummary): CurrentMapFile {
  return {
    filePath: savedMap.filePath,
    savedMapName: savedMap.name
  };
}

export function newMapNameError(mapName: string, savedMaps: SavedMapSummary[]): string | undefined {
  const normalizedName = normalizeMapName(mapName);
  if (!normalizedName) {
    return "Enter a map name.";
  }
  if (savedMaps.some((savedMap) => normalizeMapName(savedMap.name) === normalizedName)) {
    return "A saved map already uses this name.";
  }
  return undefined;
}

export function saveMapNameError(
  mapName: string,
  savedMaps: SavedMapSummary[],
  currentFile: CurrentMapFile | null
): string | undefined {
  const normalizedName = normalizeMapName(mapName);
  if (!normalizedName) {
    return "Enter a map name.";
  }

  const clashingMap = savedMaps.find((savedMap) => normalizeMapName(savedMap.name) === normalizedName);
  if (clashingMap && clashingMap.filePath !== currentFile?.filePath) {
    return "A saved map already uses this name.";
  }

  return undefined;
}

export function saveRequestForEditorState(
  state: Pick<EditorState, "mapName">,
  currentFile: CurrentMapFile | null,
  contents: string
): SaveMapRequest {
  const mapName = state.mapName.trim();
  const shouldOverwriteCurrent =
    currentFile !== null && normalizeMapName(currentFile.savedMapName) === normalizeMapName(mapName);

  return {
    contents,
    filePath: shouldOverwriteCurrent ? currentFile.filePath : undefined,
    mapName
  };
}

export function parseSavedMapContents(contents: string): CustomMapImport {
  return validateCustomMapImportForSave(JSON.parse(contents));
}

export function importMapFileForSave(contents: string, savedMaps: SavedMapSummary[]): ImportMapFileResult {
  const map = parseSavedMapContents(contents);
  const error = newMapNameError(map.name, savedMaps);
  if (error) {
    return { error };
  }

  return {
    map,
    request: {
      contents: `${JSON.stringify(map, null, 2)}\n`,
      mapName: map.name
    }
  };
}

export function editorStateFromSavedMap(map: CustomMapImport): EditorState {
  return {
    mapName: map.name,
    worldBounds: { ...(map.worldBounds ?? worldBoundsForMapSize(defaultMapSizePreset)) },
    terrainShapes: map.terrain.blobs.map((blob) => ({
      id: blob.id,
      points: blob.outer.map((point) => ({ ...point }))
    })),
    spawnPoints: map.spawnPoints.map((spawnPoint) => ({
      id: spawnPoint.id,
      position: { ...spawnPoint.position }
    })),
    teamSpawnPointIds: {
      "team-a": [...map.teamSpawnPointIds["team-a"]],
      "team-b": [...map.teamSpawnPointIds["team-b"]]
    },
    penPoints: [],
    selection: null
  };
}
