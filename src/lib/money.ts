/**
 * Money is integer cents everywhere. These helpers are the only place where
 * cents become strings, and the only place where strings become cents.
 */

export function assertCents(value: number, label = "amount"): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative whole number of cents, got ${value}`);
  }
  return value;
}

/** 1250 -> "12.50". This is the format PayPal expects in `value` fields. */
export function centsToDecimal(cents: number): string {
  assertCents(cents);
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}

/** "12.50", "12.5", "12", "$12.50", "1,250.00" -> cents. Returns null when it is not a price. */
export function parseToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^[^\d.]+/, "").replace(/,/g, "").trim();
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const frac = match[2] ? Number(match[2].padEnd(2, "0")) : 0;
  return whole * 100 + frac;
}

/** PayPal decimal strings back to cents, strict: exactly what PayPal sends. */
export function decimalToCents(value: string): number {
  const match = /^(\d+)\.(\d{2})$/.exec(value);
  if (!match) throw new Error(`Not a two-decimal amount: ${value}`);
  return Number(match[1]) * 100 + Number(match[2]);
}

export function lineTotal(unitPriceCents: number, quantity: number): number {
  assertCents(unitPriceCents, "unit price");
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(`quantity must be a positive whole number, got ${quantity}`);
  }
  return assertCents(unitPriceCents * quantity, "line total");
}

export function sumCents(values: number[]): number {
  return assertCents(
    values.reduce((acc, v) => acc + assertCents(v), 0),
    "sum",
  );
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
