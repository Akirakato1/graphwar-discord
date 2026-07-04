import type { FunctionFamilyId } from "@graphwar/shared";
import { NormalFunction } from "./NormalFunction";
import type { ShotFunction } from "./ShotFunction";

export class FunctionRegistry {
  create(familyId: FunctionFamilyId, expression: string): ShotFunction {
    if (familyId === "normal") {
      return NormalFunction.parse(expression);
    }
    throw new Error(`Unsupported function family: ${familyId}`);
  }
}
