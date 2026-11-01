/** Length formatting and parsing. All lengths are inches. */

function roundTo(x: number, den: number): number {
  return Math.round(x * den) / den;
}

/** Inches as a whole number plus a reduced fraction, e.g. `23 5/8`. */
export function formatFraction(inches: number, den = 16): string {
  if (!Number.isFinite(inches)) return '?';
  const neg = inches < 0;
  const total = Math.round(Math.abs(inches) * den);
  if (total === 0) return '0';
  const whole = Math.floor(total / den);
  let num = total - whole * den;
  let d = den;
  while (num && num % 2 === 0 && d % 2 === 0) {
    num /= 2;
    d /= 2;
  }
  const s = num ? (whole ? `${whole} ${num}/${d}` : `${num}/${d}`) : `${whole}`;
  return (neg ? '-' : '') + s;
}

/** Inches with an inch mark, e.g. `23 5/8″`. */
export const formatInches = (inches: number, den = 16): string => `${formatFraction(inches, den)}″`;

/** Feet and inches, e.g. `11′ 10 3/8″`. Under a foot shows inches only. */
export function formatFeetInches(inches: number, den = 16): string {
  if (!Number.isFinite(inches)) return '?';
  const neg = inches < 0;
  const r = roundTo(Math.abs(inches), den);
  const feet = Math.floor((r + 1e-9) / 12);
  const rest = roundTo(r - feet * 12, den);
  const body = feet ? `${feet}′ ${formatFraction(rest, den)}″` : `${formatFraction(rest, den)}″`;
  return (neg ? '-' : '') + body;
}

const NUMBER = String.raw`(?:\d+(?:\.\d+)?(?:[\s-]+\d+\/\d+)?|\d+\/\d+|\.\d+)`;
const FEET_MARK = String.raw`(?:'|′|ft\.?|feet|foot)`;
const INCH_MARK = String.raw`(?:"|″|''|in\.?|inch|inches)`;
const LENGTH = new RegExp(String.raw`^(?:(${NUMBER})\s*${FEET_MARK}\s*(?:-\s*)?)?(?:(${NUMBER})\s*${INCH_MARK}?)?$`, 'i');

function parseNumber(s: string): number | null {
  const t = s.trim();
  let m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : null;
  m = /^(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?$/.exec(t);
  if (m) {
    if (m[2] !== undefined) {
      if (!Number(m[3])) return null;
      return Number(m[1]) + Number(m[2]) / Number(m[3]);
    }
    return Number(m[1]);
  }
  m = /^\.\d+$/.exec(t);
  if (m) return Number(t);
  return null;
}

/**
 * Parses a length typed by the owner. Plain numbers are inches. Accepts
 * `23 5/8`, `23-5/8`, `23.625`, `5/8`, `142in`, `11'`, `11' 10 3/8"`, `11ft 6in`.
 * Returns null when the text is not a length.
 */
export function parseLength(text: string): number | null {
  const s = text.trim();
  if (!s) return null;
  const m = LENGTH.exec(s);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  let total = 0;
  if (m[1] !== undefined) {
    const feet = parseNumber(m[1]);
    if (feet === null) return null;
    total += feet * 12;
  }
  if (m[2] !== undefined) {
    const inches = parseNumber(m[2]);
    if (inches === null) return null;
    total += inches;
  }
  return Number.isFinite(total) ? total : null;
}
