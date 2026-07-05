import type { CustomMapSpawnPoint, CustomMapTeamSpawnPointIds, WorldPoint } from "@graphwar/shared";

export type EditorTerrainShape = {
  id: string;
  points: WorldPoint[];
};

export type EditorSelection =
  | {
      type: "terrain" | "spawn";
      id: string;
    }
  | null;

export type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type EditorState = {
  mapName: string;
  terrainShapes: EditorTerrainShape[];
  spawnPoints: CustomMapSpawnPoint[];
  teamSpawnPointIds: CustomMapTeamSpawnPointIds;
  penPoints: WorldPoint[];
  selection: EditorSelection;
};
