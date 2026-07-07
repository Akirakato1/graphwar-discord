import { z } from "zod";

export type WorldBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export const mapSizePresetIds = ["small", "standard", "large", "huge"] as const;
export type MapSizePresetId = (typeof mapSizePresetIds)[number];

export type MapSizePreset = {
  id: MapSizePresetId;
  width: number;
  height: number;
  worldBounds: WorldBounds;
};

export function centeredWorldBounds(width: number, height: number): WorldBounds {
  return {
    minX: -width / 2,
    maxX: width / 2,
    minY: -height / 2,
    maxY: height / 2
  };
}

export const mapSizePresetCatalog = {
  small: { id: "small", width: 40, height: 24, worldBounds: centeredWorldBounds(40, 24) },
  standard: { id: "standard", width: 50, height: 30, worldBounds: centeredWorldBounds(50, 30) },
  large: { id: "large", width: 75, height: 45, worldBounds: centeredWorldBounds(75, 45) },
  huge: { id: "huge", width: 100, height: 60, worldBounds: centeredWorldBounds(100, 60) }
} as const satisfies Record<MapSizePresetId, MapSizePreset>;

export const mapSizePresets = mapSizePresetIds.map((id) => mapSizePresetCatalog[id]);

export const defaultMapSizePreset: MapSizePresetId = "standard";

export const mapSizePresetSchema = z.enum(mapSizePresetIds);

export const worldBoundsSchema = z
  .object({
    minX: z.number().finite(),
    maxX: z.number().finite(),
    minY: z.number().finite(),
    maxY: z.number().finite()
  })
  .refine((bounds) => bounds.minX < bounds.maxX, "minX must be less than maxX")
  .refine((bounds) => bounds.minY < bounds.maxY, "minY must be less than maxY");

export function worldBoundsForMapSize(mapSizePreset: MapSizePresetId): WorldBounds {
  return { ...mapSizePresetCatalog[mapSizePreset].worldBounds };
}

export function boundsWidth(bounds: WorldBounds): number {
  return bounds.maxX - bounds.minX;
}

export function boundsHeight(bounds: WorldBounds): number {
  return bounds.maxY - bounds.minY;
}

export function isWorldPointInBounds(point: { x: number; y: number }, bounds: WorldBounds): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}
