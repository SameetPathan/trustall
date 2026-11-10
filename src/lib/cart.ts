import { lineTotal, sumCents, assertCents } from "./money";

export interface CartLineInput {
  productId: string;
  quantity: number;
  aiConfidence?: number | null;
  editedByCustomer?: boolean;
}

export interface PriceableProduct {
  id: string;
  name: string;
  unit: string;
  priceCents: number;
  active: boolean;
}

export interface PricedLine {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  aiConfidence: number | null;
  editedByCustomer: boolean;
}

export interface PricedCart {
  lines: PricedLine[];
  itemsTotalCents: number;
  tipCents: number;
  totalCents: number;
}

export class CartError extends Error {}

export const MAX_STALL_QTY = 20;
export const MAX_TIP_CENTS = 5000;

/**
 * Prices a cart from the stall's own catalog. The browser (and the model)
 * only ever say which product and how many. Any price they send is ignored
 * because this function never reads one.
 */
export function priceCart(
  input: CartLineInput[],
  catalog: PriceableProduct[],
  opts: { tipCents?: number; maxQuantity?: number } = {},
): PricedCart {
  const maxQuantity = opts.maxQuantity ?? MAX_STALL_QTY;
  if (!Array.isArray(input) || input.length === 0) throw new CartError("The cart is empty.");
  const byId = new Map(catalog.map((p) => [p.id, p]));

  const merged = new Map<string, PricedLine>();
  for (const line of input) {
    const product = byId.get(line.productId);
    if (!product || !product.active) {
      throw new CartError("One of the items is no longer sold at this stall. Remove it and try again.");
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new CartError(`The quantity for ${product.name} must be a whole number of 1 or more.`);
    }
    const existing = merged.get(product.id);
    const quantity = (existing?.quantity ?? 0) + line.quantity;
    if (quantity > maxQuantity) {
      throw new CartError(`You can buy at most ${maxQuantity} of ${product.name} in one go.`);
    }
    const confidence =
      typeof line.aiConfidence === "number" && line.aiConfidence >= 0 && line.aiConfidence <= 1
        ? line.aiConfidence
        : null;
    merged.set(product.id, {
      productId: product.id,
      name: `${product.name} (${product.unit})`,
      quantity,
      unitPriceCents: product.priceCents,
      lineTotalCents: lineTotal(product.priceCents, quantity),
      aiConfidence: existing ? existing.aiConfidence : confidence,
      editedByCustomer: Boolean(line.editedByCustomer) || Boolean(existing?.editedByCustomer),
    });
  }

  const lines = [...merged.values()];
  const itemsTotalCents = sumCents(lines.map((l) => l.lineTotalCents));
  const tipCents = opts.tipCents ?? 0;
  assertCents(tipCents, "tip");
  if (tipCents > MAX_TIP_CENTS) throw new CartError("That tip is larger than this stall accepts.");
  return { lines, itemsTotalCents, tipCents, totalCents: itemsTotalCents + tipCents };
}
