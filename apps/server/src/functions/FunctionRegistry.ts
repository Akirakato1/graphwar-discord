import type { FunctionFamilyId } from "@graphwar/shared";
import { NormalFunction } from "./NormalFunction";
import type { ShotFunction } from "./ShotFunction";

export type FunctionCreateOptions = {
  advancedFunctions?: boolean;
};

export class FunctionRegistry {
  create(familyId: FunctionFamilyId, expression: string, options: FunctionCreateOptions = {}): ShotFunction {
    if (familyId === "normal") {
      return NormalFunction.parse(expression, options);
    }
    throw new Error(`Unsupported function family: ${familyId}`);
  }
}
