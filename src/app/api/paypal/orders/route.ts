import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { priceCart, type CartLineInput } from "@/lib/cart";
import { fail, failFrom } from "@/lib/http";
import { createOrder } from "@/lib/paypal";
import { allow, clientKey } from "@/lib/ratelimit";
import { createDraftSale, getCatalog, getStallBySlug } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * POST { slug, lines: [{ productId, quantity, aiConfidence?, editedByCustomer? }], tipCents?, photoId? }
 * The server prices the cart from its own database, stores a DRAFT sale, and
 * creates a PayPal order for exactly that amount.
 */
export async function POST(req: Request) {
  try {
    if (!allow(clientKey(req, "orders"), 30)) return fail("Too many attempts. Wait a moment and try again.", 429);
    const body = (await req.json().catch(() => null)) as {
      slug?: string;
      lines?: CartLineInput[];
      tipCents?: number;
      photoId?: string | null;
    } | null;
    if (!body?.slug || !Array.isArray(body.lines)) return fail("Missing cart.");
    const stall = await getStallBySlug(body.slug);
    if (!stall) return fail("Stall not found.", 404);

    const catalog = await getCatalog(stall.id);
    const tipCents = Number.isInteger(body.tipCents) ? (body.tipCents as number) : 0;
    const cart = priceCart(body.lines, catalog, { tipCents });
    const saleId = await createDraftSale({
      stall,
      cart,
      photoId: typeof body.photoId === "string" ? body.photoId : null,
    });

    const order = await createOrder({
      saleId,
      stallName: stall.name,
      currency: stall.currency,
      lines: cart.lines,
      tipCents: cart.tipCents,
      totalCents: cart.totalCents,
    });
    await getDb().update(schema.sales).set({ paypalOrderId: order.data.id }).where(eq(schema.sales.id, saleId));

    return NextResponse.json({ orderId: order.data.id, saleId, totalCents: cart.totalCents });
  } catch (err) {
    return failFrom(err);
  }
}
