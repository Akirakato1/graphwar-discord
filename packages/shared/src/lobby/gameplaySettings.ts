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
export const defaultFunctionHistory = true;
export const defaultTurnTimerEnabled = true;
export const inputModes = ["keypad", "keyboard", "hybrid"] as const;
export type FunctionInputMode = (typeof inputModes)[number];
export const defaultInputMode: FunctionInputMode = "hybrid";

export const turnDurationSecondsBounds = {
  min: 15,
  max: 300,
  step: 15,
  default: 60
} as const;

export const defaultTurnDurationSeconds = turnDurationSecondsBounds.default;

export type LobbyGameplaySettings = {
  damagePerHit: number;
  craterRadius: number;
  uniqueFunctionHits: boolean;
  friendlyFire: boolean;
  advancedFunctions: boolean;
  functionPreview: boolean;
  functionHistory: boolean;
  turnTimerEnabled: boolean;
  turnDurationSeconds: number;
  inputMode: FunctionInputMode;
};

export const defaultLobbyGameplaySettings: LobbyGameplaySettings = {
  damagePerHit: damagePerHitBounds.default,
  craterRadius: craterRadiusBounds.default,
  uniqueFunctionHits: defaultUniqueFunctionHits,
  friendlyFire: defaultFriendlyFire,
  advancedFunctions: defaultAdvancedFunctions,
  functionPreview: defaultFunctionPreview,
  functionHistory: defaultFunctionHistory,
  turnTimerEnabled: defaultTurnTimerEnabled,
  turnDurationSeconds: defaultTurnDurationSeconds,
  inputMode: defaultInputMode
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

export function normalizeTurnDurationSeconds(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultTurnDurationSeconds;
  }

  const roundedToStep = Math.round(value / turnDurationSecondsBounds.step) * turnDurationSecondsBounds.step;
  return Math.min(turnDurationSecondsBounds.max, Math.max(turnDurationSecondsBounds.min, roundedToStep));
}

export function normalizeInputMode(value: unknown): FunctionInputMode {
  return inputModes.includes(value as FunctionInputMode) ? (value as FunctionInputMode) : defaultInputMode;
}

export function normalizeFunctionHitExpression(expression: string): string {
  return expression.replace(/[ \t\r\n\f\v]+/g, "");
}
