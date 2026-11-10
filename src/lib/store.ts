import { and, desc, eq, gte, inArray, lte, asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Stall, Product } from "@/db/schema";
import type { PricedCart } from "./cart";
import type { WebhookStore } from "./webhook";
import { newId } from "./ids";
import { reconcile, type ReconcileResult } from "./reconcile";

const { stalls, products, sales, saleItems, shelfCounts, shelfCountItems, webhookEvents, photos, contacts } = schema;

export async function getStallBySlug(slug: string): Promise<Stall | null> {
  return (await getDb().query.stalls.findFirst({ where: eq(stalls.slug, slug) })) ?? null;
}

export async function getStallById(id: string): Promise<Stall | null> {
  return (await getDb().query.stalls.findFirst({ where: eq(stalls.id, id) })) ?? null;
}

export async function getCatalog(stallId: string, opts: { includeInactive?: boolean } = {}): Promise<Product[]> {
  const rows = await getDb().query.products.findMany({
    where: opts.includeInactive ? eq(products.stallId, stallId) : and(eq(products.stallId, stallId), eq(products.active, true)),
    orderBy: [asc(products.sort), asc(products.name)],
  });
  return rows;
}

export async function getContacts(stallId: string) {
  return getDb().query.contacts.findMany({ where: eq(contacts.stallId, stallId) });
}

export async function savePhoto(stallId: string | null, mime: string, dataBase64: string): Promise<string> {
  const id = newId("photo");
  await getDb().insert(photos).values({ id, stallId, mime, dataBase64 });
  return id;
}

export async function createDraftSale(args: {
  stall: Stall;
  cart: PricedCart;
  photoId?: string | null;
  source?: "STALL" | "AGENT";
  customerEmail?: string | null;
}) {
  const id = newId("sale");
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(sales).values({
      id,
      stallId: args.stall.id,
      status: "DRAFT",
      totalCents: args.cart.totalCents,
      tipCents: args.cart.tipCents,
      currency: args.stall.currency,
      source: args.source ?? "STALL",
      customerEmail: args.customerEmail ?? null,
      photoId: args.photoId ?? null,
    });
    await tx.insert(saleItems).values(
      args.cart.lines.map((l) => ({
        id: newId("item"),
        saleId: id,
        productId: l.productId,
        name: l.name,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        aiConfidence: l.aiConfidence,
        editedByCustomer: l.editedByCustomer,
      })),
    );
  });
  return id;
}

export async function getSale(saleId: string) {
  return (await getDb().query.sales.findFirst({ where: eq(sales.id, saleId), with: { items: true } })) ?? null;
}

/** DRAFT or INVOICED -> PAID. Only ever called with PayPal's own confirmation in hand. */
export async function markSalePaid(saleId: string, captureId: string | null, orderId: string | null): Promise<boolean> {
  const rows = await getDb()
    .update(sales)
    .set({
      status: "PAID",
      paidAt: new Date(),
      ...(captureId ? { paypalCaptureId: captureId } : {}),
      ...(orderId ? { paypalOrderId: orderId } : {}),
    })
    .where(and(eq(sales.id, saleId), inArray(sales.status, ["DRAFT", "INVOICED"])))
    .returning({ id: sales.id });
  return rows.length > 0;
}

export async function markSaleRefundedByCapture(captureId: string, refundId: string): Promise<boolean> {
  const rows = await getDb()
    .update(sales)
    .set({ status: "REFUNDED", paypalRefundId: refundId })
    .where(and(eq(sales.paypalCaptureId, captureId), eq(sales.status, "PAID")))
    .returning({ id: sales.id });
  return rows.length > 0;
}

export const dbWebhookStore: WebhookStore = {
  async recordEvent(id, type) {
    const rows = await getDb()
      .insert(webhookEvents)
      .values({ id, type, verified: true })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    return rows.length > 0;
  },
  async forgetEvent(id) {
    await getDb().delete(webhookEvents).where(eq(webhookEvents.id, id));
  },
  markPaidBySaleId: (saleId, captureId, orderId) => markSalePaid(saleId, captureId, orderId),
  markRefundedByCaptureId: (captureId, refundId) => markSaleRefundedByCapture(captureId, refundId),
  async markPaidByInvoiceId(invoiceId) {
    const rows = await getDb()
      .update(sales)
      .set({ status: "PAID", paidAt: new Date() })
      .where(and(eq(sales.paypalInvoiceId, invoiceId), eq(sales.status, "INVOICED")))
      .returning({ id: sales.id });
    return rows.length > 0;
  },
};

export interface LedgerSale {
  id: string;
  status: "PAID" | "INVOICED" | "REFUNDED";
  totalCents: number;
  tipCents: number;
  currency: string;
  source: string;
  customerEmail: string | null;
  createdAt: string;
  paidAt: string | null;
  hasPhoto: boolean;
  photoId: string | null;
  items: { productId: string; name: string; quantity: number; unitPriceCents: number; aiConfidence: number | null; editedByCustomer: boolean }[];
}

/** Sales PayPal knows about. Drafts (carts nobody paid) are left out. */
export async function getLedger(stallId: string, opts: { since?: Date; limit?: number } = {}): Promise<LedgerSale[]> {
  const rows = await getDb().query.sales.findMany({
    where: and(
      eq(sales.stallId, stallId),
      inArray(sales.status, ["PAID", "INVOICED", "REFUNDED"]),
      opts.since ? gte(sales.createdAt, opts.since) : undefined,
    ),
    with: { items: true },
    orderBy: [desc(sales.createdAt)],
    limit: opts.limit ?? 200,
  });
  return rows.map((s) => ({
    id: s.id,
    status: s.status as LedgerSale["status"],
    totalCents: s.totalCents,
    tipCents: s.tipCents,
    currency: s.currency,
    source: s.source,
    customerEmail: s.customerEmail,
    createdAt: s.createdAt.toISOString(),
    paidAt: s.paidAt ? s.paidAt.toISOString() : null,
    hasPhoto: Boolean(s.photoId),
    photoId: s.photoId,
    items: s.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      aiConfidence: i.aiConfidence,
      editedByCustomer: i.editedByCustomer,
    })),
  }));
}

export async function saveShelfCount(args: {
  stallId: string;
  kind: "OPEN" | "CLOSE";
  photoId: string | null;
  items: { productId: string; units: number }[];
}) {
  const id = newId("shelf");
  await getDb().transaction(async (tx) => {
    await tx.insert(shelfCounts).values({ id, stallId: args.stallId, kind: args.kind, photoId: args.photoId });
    if (args.items.length > 0) {
      await tx
        .insert(shelfCountItems)
        .values(args.items.map((i) => ({ id: newId("sci"), shelfCountId: id, productId: i.productId, units: i.units })));
    }
  });
  return id;
}

export interface ShelfStatus {
  open: { takenAt: string; counts: Record<string, number> } | null;
  close: { takenAt: string; counts: Record<string, number> } | null;
  honesty: ReconcileResult | null;
  lowStock: { productId: string; name: string; unit: string; estimated: number; lowStockAt: number }[];
}

async function paidUnits(stallId: string, from: Date, to: Date): Promise<Record<string, number>> {
  const rows = await getDb().query.sales.findMany({
    where: and(eq(sales.stallId, stallId), eq(sales.status, "PAID"), gte(sales.createdAt, from), lte(sales.createdAt, to)),
    with: { items: true },
  });
  const units: Record<string, number> = {};
  for (const s of rows) for (const i of s.items) units[i.productId] = (units[i.productId] ?? 0) + i.quantity;
  return units;
}

/**
 * The honesty window runs from the most recent opening count to the first
 * closing count after it. Paid units are PAID sales made inside that window.
 */
export async function getShelfStatus(stallId: string): Promise<ShelfStatus> {
  const db = getDb();
  const catalog = await getCatalog(stallId);
  const open = await db.query.shelfCounts.findFirst({
    where: and(eq(shelfCounts.stallId, stallId), eq(shelfCounts.kind, "OPEN")),
    orderBy: [desc(shelfCounts.takenAt)],
    with: { items: true },
  });
  const toCounts = (items: { productId: string; units: number }[]) =>
    Object.fromEntries(items.map((i) => [i.productId, i.units]));

  if (!open) return { open: null, close: null, honesty: null, lowStock: [] };

  const close = await db.query.shelfCounts.findFirst({
    where: and(eq(shelfCounts.stallId, stallId), eq(shelfCounts.kind, "CLOSE"), gte(shelfCounts.takenAt, open.takenAt)),
    orderBy: [asc(shelfCounts.takenAt)],
    with: { items: true },
  });

  const openCounts = toCounts(open.items);
  const closeCounts = close ? toCounts(close.items) : null;

  let honesty: ReconcileResult | null = null;
  if (close && closeCounts) {
    const paid = await paidUnits(stallId, open.takenAt, close.takenAt);
    honesty = reconcile(
      catalog
        .filter((p) => p.id in openCounts)
        .map((p) => ({
          productId: p.id,
          name: `${p.name} (${p.unit})`,
          open: openCounts[p.id] ?? 0,
          close: closeCounts[p.id] ?? 0,
          paid: paid[p.id] ?? 0,
          priceCents: p.priceCents,
        })),
    );
  }

  // Low stock: last count, minus what has been paid for since it was taken.
  const latest = close ?? open;
  const latestCounts = closeCounts ?? openCounts;
  const soldSince = await paidUnits(stallId, latest.takenAt, new Date());
  const lowStock = catalog
    .filter((p) => p.id in latestCounts)
    .map((p) => ({
      productId: p.id,
      name: p.name,
      unit: p.unit,
      estimated: Math.max(0, (latestCounts[p.id] ?? 0) - (soldSince[p.id] ?? 0)),
      lowStockAt: p.lowStockAt,
    }))
    .filter((p) => p.estimated <= p.lowStockAt);

  return {
    open: { takenAt: open.takenAt.toISOString(), counts: openCounts },
    close: close && closeCounts ? { takenAt: close.takenAt.toISOString(), counts: closeCounts } : null,
    honesty,
    lowStock,
  };
}
