export type InvalidFunctionBehavior = "reject" | "explode-at-shooter";

export type FunctionValidationSettings = {
  requireFiniteLocalYIntercept: boolean;
  requireRawXIntercept: boolean;
  invalidFunctionBehavior: InvalidFunctionBehavior;
};

export const defaultFunctionValidationSettings: FunctionValidationSettings = {
  requireFiniteLocalYIntercept: true,
  requireRawXIntercept: false,
  invalidFunctionBehavior: "reject"
};
