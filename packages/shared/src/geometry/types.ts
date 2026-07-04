export type LocalPoint = { x: number; y: number };
export type WorldPoint = { x: number; y: number };
export type PolygonRing = WorldPoint[];

export type TerrainBlob = {
  id: string;
  outer: PolygonRing;
  holes: PolygonRing[];
};

export type TerrainState = {
  blobs: TerrainBlob[];
};
