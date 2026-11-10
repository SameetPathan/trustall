import { describe, expect, it } from "vitest";
import { formatRate, reconcile } from "@/lib/reconcile";

const row = (open: number, close: number, paid: number, priceCents = 100, id = "p") => ({
  productId: id,
  name: id,
  open,
  close,
  paid,
  priceCents,
});

describe("honesty score", () => {
  it("is 100% when everything that left was paid for", () => {
    const r = reconcile([row(10, 6, 4)]);
    expect(r.rate).toBe(1);
    expect(r.gapCents).toBe(0);
  });

  it("matches the formula sum(min(paid, gone)) / sum(gone)", () => {
    const r = reconcile([row(10, 4, 5, 600, "eggs"), row(5, 3, 2, 900, "honey"), row(8, 8, 0, 150, "zucchini")]);
    expect(r.unitsGone).toBe(8);
    expect(r.unitsPaid).toBe(7);
    expect(r.rate).toBeCloseTo(7 / 8);
    expect(r.unpaidUnits).toBe(1);
    expect(r.gapCents).toBe(600);
    expect(formatRate(r.rate)).toBe("88%");
  });

  it("does not let overpayment on one product hide a loss on another", () => {
    const r = reconcile([row(5, 3, 6, 100, "a"), row(5, 3, 0, 100, "b")]);
    expect(r.unitsGone).toBe(4);
    expect(r.unitsPaid).toBe(2);
    expect(r.rate).toBe(0.5);
  });

  it("treats a restock as nothing gone, and gives no rate when nothing left", () => {
    const r = reconcile([row(3, 7, 2)]);
    expect(r.unitsGone).toBe(0);
    expect(r.rate).toBeNull();
    expect(formatRate(r.rate)).toBe("n/a");
  });

  it("rejects counts that are not whole numbers", () => {
    expect(() => reconcile([row(1.5, 0, 0)])).toThrow();
    expect(() => reconcile([row(1, -1, 0)])).toThrow();
  });
});
