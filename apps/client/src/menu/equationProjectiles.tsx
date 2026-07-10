import type { ReactNode } from "react";

type EquationProjectile = {
  id: string;
  lane: number;
  delaySeconds: number;
  durationSeconds: number;
  expression: ReactNode;
};

const equationTemplates: ReactNode[] = [
  <>y=x<sup>2</sup>+3x-2</>,
  <>sin(x)+cos(2x)</>,
  <>tan(x/2)</>,
  <>e<sup>-x</sup>sin(x)</>,
  <>⌊x⌋+⌈x/2⌉</>,
  <>Γ(x+1)</>,
  <>ψ(x)+ζ(2)</>,
  <>Β(x,2)</>,
  <>∫<sub>0</sub><sup>x</sup> sin(t) dt</>,
  <>∫<sub>-1</sub><sup>1</sup> e<sup>-t<sup>2</sup></sup> dt</>,
  <>Σ<sub>n=0</sub><sup>x</sup> n<sup>2</sup></>,
  <>Σ<sub>n=1</sub><sup>x</sup> sin(n)</>,
  <>sqrt(abs(x))+log(x+4)</>,
  <>abs(sin(x))</>,
  <>x<sup>3</sup>-4x</>,
  <>cos(x)ζ(x)</>,
  <>Γ(x)sin(πx)</>,
  <>D<sub>x</sub><sup>1</sup> cos(x)</>,
  <>int(t,0,x,t<sup>2</sup>)</>,
  <>sum(n,0,x,cos(n))</>
];

export const equationProjectiles: EquationProjectile[] = Array.from({ length: 200 }, (_, index) => ({
  id: `equation-${index}`,
  lane: index % 10,
  delaySeconds: Number((index * 0.42).toFixed(2)),
  durationSeconds: 8 + (index % 7) * 0.55,
  expression: equationTemplates[index % equationTemplates.length]
}));
