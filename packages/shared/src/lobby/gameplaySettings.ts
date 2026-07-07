import { defaultMatchTuning } from "../constants";

export const damagePerHitBounds = {
  min: 35,
  max: 100,
  default: defaultMatchTuning.directHitDamage
} as const;

export const craterRadiusBounds = {
  min: 0.5,
  max: 3,
  step: 0.25,
  default: defaultMatchTuning.circleCraterRadius
} as const;

export const defaultUniqueFunctionHits = true;
export const defaultFriendlyFire = false;
export const defaultAdvancedFunctions = false;
export const defaultFunctionPreview = true;

export type LobbyGameplaySettings = {
  damagePerHit: number;
  craterRadius: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
  advancedFunctions: boolean;
  functionPreview: boolean;
};

export const defaultLobbyGameplaySettings: LobbyGameplaySettings = {
  damagePerHit: damagePerHitBounds.default,
  craterRadius: craterRadiusBounds.default,
  uniqueFunctionHits: defaultUniqueFunctionHits,
  friendlyFire: defaultFriendlyFire,
  advancedFunctions: defaultAdvancedFunctions,
  functionPreview: defaultFunctionPreview
};

export function normalizeDamagePerHit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return damagePerHitBounds.default;
  }

  const rounded = Math.round(value);
  return Math.min(damagePerHitBounds.max, Math.max(damagePerHitBounds.min, rounded));
}

export function normalizeCraterRadius(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return craterRadiusBounds.default;
  }

  const roundedToStep = Math.round(value / craterRadiusBounds.step) * craterRadiusBounds.step;
  const clamped = Math.min(craterRadiusBounds.max, Math.max(craterRadiusBounds.min, roundedToStep));
  return Number(clamped.toFixed(2));
}

export function normalizeFunctionHitExpression(expression: string): string {
  return expression.replace(/[ \t\r\n\f\v]+/g, "");
}
