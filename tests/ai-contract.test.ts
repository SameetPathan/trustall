import { describe, expect, it } from "vitest";
import { sanitiseCart } from "@/lib/ai";
import { extractInvoiceId } from "@/lib/paypal";

const catalog = [
  { id: "prod_eggs_dozen", name: "Eggs", unit: "dozen" },
  { id: "prod_honey_340g", name: "Honey", unit: "jar" },
];

describe("vision contract", () => {
  it("keeps only catalog ids, whole quantities 1 to 20 and confidences 0 to 1", () => {
    const out = sanitiseCart(
      {
        lines: [
          { productId: "prod_eggs_dozen", quantity: 2, confidence: 0.93 },
          { productId: "prod_made_up", quantity: 1, confidence: 0.99 },
          { productId: "prod_honey_340g", quantity: 0, confidence: 0.9 },
          { productId: "prod_honey_340g", quantity: 45, confidence: 0.9 },
        ],
        unrecognised: ["a bunch of flowers, not in the catalog"],
      },
      catalog,
    );
    expect(out.lines).toEqual([
      { productId: "prod_eggs_dozen", quantity: 2, confidence: 0.93 },
      { productId: "prod_honey_340g", quantity: 20, confidence: 0.5 }, // clamped, so flagged for the customer
    ]);
    expect(out.unrecognised).toHaveLength(1);
  });

  it("drops any extra field the model adds, including prices", () => {
    const out = sanitiseCart(
      { lines: [{ productId: "prod_eggs_dozen", quantity: 1, confidence: 2, price: 0.01 } as never], unrecognised: [] },
      catalog,
    );
    expect(out.lines).toEqual([{ productId: "prod_eggs_dozen", quantity: 1, confidence: 1 }]);
  });

  it("finds a PayPal invoice id in whatever shape the response has", () => {
    expect(extractInvoiceId({ rel: "self", href: "https://api.sandbox.paypal.com/v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5", method: "GET" })).toBe("INV2-Z56S-5LLA-Q52L-CPZ5");
    expect(extractInvoiceId('{"id":"INV2-W4LC-6QS9-JZ62-VE4P","status":"DRAFT"}')).toBe("INV2-W4LC-6QS9-JZ62-VE4P");
    expect(extractInvoiceId({ error: "nope" })).toBeNull();
  });
});
