import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { priceCart, type CartLineInput } from "@/lib/cart";
import { fail, failFrom } from "@/lib/http";
import { createAndSendInvoice } from "@/lib/paypal";
import { allow, clientKey } from "@/lib/ratelimit";
import { createDraftSale, getCatalog, getStallBySlug } from "@/lib/store";

export const dynamic = "force-dynamic";

/** "Invoice me": POST { slug, lines, email, photoId? } -> creates and sends a PayPal invoice. */
export async function POST(req: Request) {
  try {
    if (!allow(clientKey(req, "invoice"), 6)) return fail("Too many invoices in a minute. Wait a moment.", 429);
    const body = (await req.json().catch(() => null)) as {
      slug?: string;
      lines?: CartLineInput[];
      email?: string;
      photoId?: string | null;
    } | null;
    if (!body?.slug || !Array.isArray(body.lines)) return fail("Missing cart.");
    const email = z.string().email().max(254).safeParse(body.email?.trim());
    if (!email.success) return fail("Enter a valid email address for the invoice.");
    const stall = await getStallBySlug(body.slug);
    if (!stall) return fail("Stall not found.", 404);

    const cart = priceCart(body.lines, await getCatalog(stall.id));
    const saleId = await createDraftSale({
      stall,
      cart,
      customerEmail: email.data,
      photoId: typeof body.photoId === "string" ? body.photoId : null,
    });
    const { invoiceId } = await createAndSendInvoice({
      reference: saleId,
      stallName: stall.name,
      currency: stall.currency,
      recipientEmail: email.data,
      lines: cart.lines,
    });
    await getDb()
      .update(schema.sales)
      .set({ status: "INVOICED", paypalInvoiceId: invoiceId })
      .where(and(eq(schema.sales.id, saleId), eq(schema.sales.status, "DRAFT")));

    return NextResponse.json({ saleId, invoiceId, totalCents: cart.totalCents, email: email.data });
  } catch (err) {
    return failFrom(err);
  }
}
