import { parseNormalFunction, type NormalFunctionParseOptions, type ParsedNormalFunction } from "@graphwar/shared";
import { ShotFunction, type SampleContext, type TrajectorySample } from "./ShotFunction";

export class NormalFunction extends ShotFunction {
  readonly familyId = "normal" as const;

  private constructor(
    private readonly expressionText: string,
    private readonly parsed: ParsedNormalFunction
  ) {
    super();
  }

  static parse(expressionText: string, options: NormalFunctionParseOptions = {}): NormalFunction {
    return new NormalFunction(expressionText, parseNormalFunction(expressionText, options));
  }

  get canonicalExpression(): string {
    return this.parsed.canonicalExpression;
  }

  sample(context: SampleContext): TrajectorySample {
    return this.parsed.sample(context);
  }

  toString(): string {
    return this.expressionText;
  }
}
