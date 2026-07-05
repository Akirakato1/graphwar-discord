export const playerColorPalette = [
  "#4cc9f0",
  "#f72585",
  "#ffd166",
  "#06d6a0",
  "#f77f00",
  "#b5179e",
  "#90be6d",
  "#577590",
  "#f94144",
  "#43aa8b"
] as const;

export type PlayerColor = (typeof playerColorPalette)[number];

export const defaultPlayerColor: PlayerColor = playerColorPalette[0];

export const functionLengthBounds = {
  min: 20,
  max: 100,
  default: 50
} as const;

export const defaultMaxFunctionLength = functionLengthBounds.default;

const playerColors = new Set<string>(playerColorPalette);

export function isPlayerColor(value: unknown): value is PlayerColor {
  return typeof value === "string" && playerColors.has(value);
}

export function normalizePlayerColor(value: unknown, fallback: PlayerColor = defaultPlayerColor): PlayerColor {
  return isPlayerColor(value) ? value : fallback;
}

export function normalizeMaxFunctionLength(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultMaxFunctionLength;
  }

  const rounded = Math.round(value);
  return Math.min(functionLengthBounds.max, Math.max(functionLengthBounds.min, rounded));
}
