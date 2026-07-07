import type { CustomMapSpawnPoint, CustomMapTeamSpawnPointIds, WorldBounds, WorldPoint } from "@graphwar/shared";

export type EditorTerrainShape = {
  id: string;
  points: WorldPoint[];
};

export type EditorSelectionItem = {
  type: "terrain" | "spawn";
  id: string;
};

export type EditorSelection =
  | EditorSelectionItem
  | {
      type: "multi";
      items: EditorSelectionItem[];
    }
  | null;

export type EditorClipboard = {
  terrainShapes: EditorTerrainShape[];
  spawnPoints: CustomMapSpawnPoint[];
  teamSpawnPointIds: CustomMapTeamSpawnPointIds;
};

export type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type EditorState = {
  mapName: string;
  worldBounds: WorldBounds;
  terrainShapes: EditorTerrainShape[];
  spawnPoints: CustomMapSpawnPoint[];
  teamSpawnPointIds: CustomMapTeamSpawnPointIds;
  penPoints: WorldPoint[];
  selection: EditorSelection;
};
