/**
 * The prototype's fraction formatting (`fmt`), used in warning messages so they read exactly as the
 * prototype's. `den` is the rounding denominator (16 or 32).
 */
export function fmt(x: number, den: number): string {
  if (!Number.isFinite(x)) return '—';
  const neg = x < 0;
  x = Math.abs(x);
  let w = Math.floor(x + 1e-9);
  let n = Math.round((x - w) * den);
  let d = den;
  if (n >= den) {
    w++;
    n = 0;
  }
  while (n && n % 2 === 0 && d % 2 === 0) {
    n /= 2;
    d /= 2;
  }
  const s = n ? (w ? `${w} ${n}/${d}` : `${n}/${d}`) : `${w}`;
  return (neg ? '-' : '') + s;
}

/** Rounds to the cut-size rounding (1/16″ or 1/32″), as the prototype's `rnd`. */
export const roundCut = (x: number, round: number): number => Math.round(x * round) / round;
