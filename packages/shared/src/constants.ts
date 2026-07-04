export const fieldBounds = {
  minX: -25,
  maxX: 25,
  minY: -15,
  maxY: 15
} as const;

export const defaultMatchTuning = {
  soldierHp: 100,
  playerHitRadius: 0.35,
  directHitDamage: 35,
  circleCraterRadius: 1.25,
  terrainMinArea: 0.05,
  sampleStep: 0.05,
  maxPathPoints: 2000
} as const;
