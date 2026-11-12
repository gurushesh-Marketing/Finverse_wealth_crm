/**
 * Exact Fixed-Precision Money Utilities
 * Finverse CRM v2 Financial Operations
 *
 * Implements currency-aware integer minor units (paise: 1 INR = 100 paise)
 * to eliminate IEEE 754 floating point arithmetic issues in consequential
 * financial calculations.
 */

export const PAISE_PER_RUPEE = 100n;

/**
 * Convert number or string amount in rupees to integer paise (BigInt).
 * Rounds fractional paise to the nearest integer.
 */
export function toPaise(val: number | string): bigint {
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      throw new TypeError('Invalid money amount: non-finite number');
    }
    val = val.toFixed(4);
  }
  const clean = val.trim();
  if (clean.length === 0) return 0n;
  const isNeg = clean.startsWith('-');
  const abs = isNeg ? clean.slice(1) : clean;
  const parts = abs.split('.');
  const wholeStr = parts[0] || '0';
  const fracStr = parts[1] || '0';

  const whole = BigInt(wholeStr);
  const paddedFrac = (fracStr + '0000').slice(0, 4);
  const fracPaiseRounded = Math.round(Number(paddedFrac) / 100);
  const paise = whole * PAISE_PER_RUPEE + BigInt(fracPaiseRounded);
  return isNeg ? -paise : paise;
}

/**
 * Convert BigInt paise to number in rupees (with 2 decimal precision).
 */
export function fromPaise(paise: bigint): number {
  const isNeg = paise < 0n;
  const abs = isNeg ? -paise : paise;
  const whole = abs / PAISE_PER_RUPEE;
  const frac = abs % PAISE_PER_RUPEE;
  const num = Number(whole) + Number(frac) / 100;
  return isNeg ? -num : num;
}

/**
 * Format paise as an exact INR decimal string (e.g. "1250000.50").
 */
export function toExactString(paise: bigint): string {
  const isNeg = paise < 0n;
  const abs = isNeg ? -paise : paise;
  const whole = abs / PAISE_PER_RUPEE;
  const frac = abs % PAISE_PER_RUPEE;
  const fracStr = frac.toString().padStart(2, '0');
  return `${isNeg ? '-' : ''}${whole.toString()}.${fracStr}`;
}

export function addPaise(...amounts: bigint[]): bigint {
  return amounts.reduce((acc, curr) => acc + curr, 0n);
}

export function subPaise(a: bigint, b: bigint): bigint {
  return a - b;
}

/**
 * Multiply paise by basis points (1 bps = 0.01% = 0.0001).
 * 10000 bps = 100%. Rounds half-up.
 */
export function multiplyBps(paise: bigint, bps: number): bigint {
  const isNeg = paise < 0n;
  const abs = isNeg ? -paise : paise;
  const bpsBig = BigInt(Math.round(bps));
  const product = abs * bpsBig + 5000n;
  const res = product / 10000n;
  return isNeg ? -res : res;
}

/**
 * Multiply paise by percentage (e.g. 15 for 15%).
 * Rounds half-up.
 */
export function multiplyPct(paise: bigint, pct: number): bigint {
  const isNeg = paise < 0n;
  const abs = isNeg ? -paise : paise;
  const bps = Math.round(pct * 100);
  const product = abs * BigInt(bps) + 5000n;
  const res = product / 10000n;
  return isNeg ? -res : res;
}
