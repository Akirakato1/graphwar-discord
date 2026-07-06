import type { FunctionFamilyId, ImpactReason, LocalPoint } from "@graphwar/shared";

export type SampleContext = {
  minX: number;
  maxX: number;
  step: number;
  maxPathPoints: number;
};

export type TrajectorySample =
  | { ok: true; points: LocalPoint[] }
  | {
      ok: false;
      reason: Extract<ImpactReason, "undefined-function" | "path-too-long">;
      points: LocalPoint[];
      lastFinitePoint?: LocalPoint;
    };

export abstract class ShotFunction {
  abstract readonly canonicalExpression: string;
  abstract readonly familyId: FunctionFamilyId;
  abstract sample(context: SampleContext): TrajectorySample;
}
