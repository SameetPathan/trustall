import { describe, expect, it } from "vitest";
import { centsToDecimal, decimalToCents, formatMoney, lineTotal, parseToCents, sumCents } from "@/lib/money";
import { CartError, priceCart } from "@/lib/cart";
import { buildOrderBody } from "@/lib/paypal";

const catalog = [
  { id: "eggs", name: "Eggs", unit: "dozen", priceCents: 600, active: true },
  { id: "honey", name: "Honey", unit: "jar", priceCents: 900, active: true },
  { id: "odd", name: "Zucchini", unit: "each", priceCents: 33, active: true },
  { id: "gone", name: "Old jam", unit: "jar", priceCents: 500, active: false },
];

describe("money", () => {
  it("formats cents as PayPal decimals", () => {
    expect(centsToDecimal(0)).toBe("0.00");
    expect(centsToDecimal(5)).toBe("0.05");
    expect(centsToDecimal(1250)).toBe("12.50");
    expect(centsToDecimal(100000)).toBe("1000.00");
  });

  it("refuses fractions of a cent and negatives", () => {
    expect(() => centsToDecimal(12.5)).toThrow();
    expect(() => centsToDecimal(-1)).toThrow();
    expect(() => lineTotal(600, 0)).toThrow();
    expect(() => lineTotal(600, 1.5)).toThrow();
  });

  it("parses prices from a price board without floating point", () => {
    expect(parseToCents("6")).toBe(600);
    expect(parseToCents("6.5")).toBe(650);
    expect(parseToCents("$6.50")).toBe(650);
    expect(parseToCents("1,250.00")).toBe(125000);
    expect(parseToCents("0.07")).toBe(7);
    expect(parseToCents("19.99")).toBe(1999); // 19.99 * 100 is 1998.9999999999998 in floating point
    expect(parseToCents("six")).toBeNull();
    expect(parseToCents("6.505")).toBeNull();
    expect(parseToCents("")).toBeNull();
  });

  it("round-trips PayPal amounts", () => {
    for (const c of [0, 1, 99, 100, 1999, 123456]) expect(decimalToCents(centsToDecimal(c))).toBe(c);
    expect(() => decimalToCents("12.5")).toThrow();
  });

  it("adds lines exactly", () => {
    expect(lineTotal(33, 3)).toBe(99);
    expect(sumCents([10, 20, 30])).toBe(60);
    expect(sumCents(Array(10).fill(10))).toBe(100); // 0.1 added ten times is not 1.0 in floating point
    expect(formatMoney(1250)).toBe("$12.50");
  });
});

describe("priceCart", () => {
  it("prices from the catalog and ignores anything the client says about price", () => {
    const sneaky = [{ productId: "eggs", quantity: 2, priceCents: 1, unitPriceCents: 1 } as never];
    const cart = priceCart(sneaky, catalog);
    expect(cart.lines[0].unitPriceCents).toBe(600);
    expect(cart.totalCents).toBe(1200);
  });

  it("merges duplicate lines and totals with a tip", () => {
    const cart = priceCart(
      [
        { productId: "eggs", quantity: 1 },
        { productId: "honey", quantity: 1, aiConfidence: 0.61 },
        { productId: "eggs", quantity: 1, editedByCustomer: true },
        { productId: "odd", quantity: 3 },
      ],
      catalog,
      { tipCents: 100 },
    );
    expect(cart.lines).toHaveLength(3);
    expect(cart.lines.find((l) => l.productId === "eggs")).toMatchObject({ quantity: 2, lineTotalCents: 1200, editedByCustomer: true });
    expect(cart.itemsTotalCents).toBe(1200 + 900 + 99);
    expect(cart.totalCents).toBe(2299);
  });

  it("rejects bad carts", () => {
    expect(() => priceCart([], catalog)).toThrow(CartError);
    expect(() => priceCart([{ productId: "nope", quantity: 1 }], catalog)).toThrow(CartError);
    expect(() => priceCart([{ productId: "gone", quantity: 1 }], catalog)).toThrow(CartError);
    expect(() => priceCart([{ productId: "eggs", quantity: 0 }], catalog)).toThrow(CartError);
    expect(() => priceCart([{ productId: "eggs", quantity: 1.5 }], catalog)).toThrow(CartError);
    expect(() => priceCart([{ productId: "eggs", quantity: 21 }], catalog)).toThrow(CartError);
    expect(() => priceCart([{ productId: "eggs", quantity: 1 }], catalog, { tipCents: -5 })).toThrow();
    expect(() => priceCart([{ productId: "eggs", quantity: 1 }], catalog, { tipCents: 999999 })).toThrow(CartError);
  });

  it("builds a PayPal order whose items add up to its total", () => {
    const cart = priceCart(
      [
        { productId: "eggs", quantity: 2 },
        { productId: "odd", quantity: 7 },
      ],
      catalog,
      { tipCents: 150 },
    );
    const body = buildOrderBody({ saleId: "sale_1", stallName: "Test", currency: "USD", ...cart });
    const unit = body.purchase_units[0];
    const itemSum = unit.items.reduce((a, i) => a + decimalToCents(i.unit_amount.value) * Number(i.quantity), 0);
    expect(itemSum).toBe(cart.totalCents);
    expect(unit.amount.value).toBe(centsToDecimal(cart.totalCents));
    expect(unit.amount.breakdown.item_total.value).toBe(unit.amount.value);
    expect(unit.custom_id).toBe("sale_1");
  });
});
