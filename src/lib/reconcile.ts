/**
 * Honesty score.
 *
 *   gone          = open - close            (per product, never below zero)
 *   honesty rate  = sum(min(paid, gone)) / sum(gone)
 *
 * A product that was restocked during the day (close > open) counts as nothing
 * gone, so a restock can not push the rate above 100%.
 */

export interface ReconcileInput {
  productId: string;
  name: string;
  open: number;
  close: number;
  paid: number;
  priceCents: number;
}

export interface ReconcileRow extends ReconcileInput {
  gone: number;
  covered: number; // min(paid, gone)
  unpaidUnits: number;
  gapCents: number;
}

export interface ReconcileResult {
  rows: ReconcileRow[];
  unitsGone: number;
  unitsPaid: number; // paid units that are matched by stock that left
  unpaidUnits: number;
  gapCents: number;
  /** 0..1, or null when nothing left the shelf. */
  rate: number | null;
}

export function reconcile(inputs: ReconcileInput[]): ReconcileResult {
  const rows = inputs.map((i) => {
    for (const [label, v] of [["open", i.open], ["close", i.close], ["paid", i.paid]] as const) {
      if (!Number.isInteger(v) || v < 0) throw new Error(`${label} count for ${i.name} must be a whole number >= 0`);
    }
    const gone = Math.max(0, i.open - i.close);
    const covered = Math.min(i.paid, gone);
    const unpaidUnits = gone - covered;
    return { ...i, gone, covered, unpaidUnits, gapCents: unpaidUnits * i.priceCents };
  });
  const unitsGone = rows.reduce((a, r) => a + r.gone, 0);
  const unitsPaid = rows.reduce((a, r) => a + r.covered, 0);
  const unpaidUnits = unitsGone - unitsPaid;
  const gapCents = rows.reduce((a, r) => a + r.gapCents, 0);
  return { rows, unitsGone, unitsPaid, unpaidUnits, gapCents, rate: unitsGone === 0 ? null : unitsPaid / unitsGone };
}

export function formatRate(rate: number | null): string {
  if (rate === null) return "n/a";
  return `${Math.round(rate * 100)}%`;
}
