import { defaultMatchTuning } from "../constants";

export const damagePerHitBounds = {
  min: 35,
  max: 100,
  default: defaultMatchTuning.directHitDamage
} as const;

export const defaultUniqueFunctionHits = true;
export const defaultFriendlyFire = false;

export type LobbyGameplaySettings = {
  damagePerHit: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
};

export const defaultLobbyGameplaySettings: LobbyGameplaySettings = {
  damagePerHit: damagePerHitBounds.default,
  uniqueFunctionHits: defaultUniqueFunctionHits,
  friendlyFire: defaultFriendlyFire
};

export function normalizeDamagePerHit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return damagePerHitBounds.default;
  }

  const rounded = Math.round(value);
  return Math.min(damagePerHitBounds.max, Math.max(damagePerHitBounds.min, rounded));
}

export function normalizeFunctionHitExpression(expression: string): string {
  return expression.replace(/[ \t\r\n\f\v]+/g, "");
}
