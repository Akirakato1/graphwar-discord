const lanczosCoefficients = [
  676.5203681218851,
  -1259.1392167224028,
  771.3234287776531,
  -176.6150291621406,
  12.507343278686905,
  -0.13857109526572012,
  9.984369578019572e-6,
  1.5056327351493116e-7
];

const halfLogTwoPi = 0.9189385332046727;

function assertFinite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Function must evaluate to a finite number");
  }
  return value;
}

export function logGamma(value: number): number {
  if (value < 0.5) {
    return assertFinite(Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value));
  }

  const z = value - 1;
  let x = 0.9999999999998099;
  for (let index = 0; index < lanczosCoefficients.length; index += 1) {
    x += lanczosCoefficients[index] / (z + index + 1);
  }

  const t = z + lanczosCoefficients.length - 0.5;
  return assertFinite(halfLogTwoPi + (z + 0.5) * Math.log(t) - t + Math.log(x));
}

export function gamma(value: number): number {
  return assertFinite(Math.exp(logGamma(value)));
}

export function factorial(value: number): number {
  return gamma(value + 1);
}

export function beta(a: number, b: number): number {
  return assertFinite(Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b)));
}

export function digamma(value: number): number {
  let x = value;
  let result = 0;

  while (x < 8) {
    result -= 1 / x;
    x += 1;
  }

  const inverse = 1 / x;
  const inverseSquared = inverse * inverse;
  result += Math.log(x) - 0.5 * inverse - inverseSquared / 12 + (inverseSquared * inverseSquared) / 120;
  return assertFinite(result);
}

export function zeta(value: number): number {
  if (!Number.isFinite(value) || value <= 1) {
    throw new Error("zeta requires a finite input greater than 1");
  }

  const terms = 4096;
  let total = 0;
  for (let n = 1; n <= terms; n += 1) {
    total += 1 / Math.pow(n, value);
  }

  const integralRemainder = Math.pow(terms, 1 - value) / (value - 1);
  return assertFinite(total + integralRemainder);
}
