import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { fail, failFrom } from "@/lib/http";
import { decimalToCents } from "@/lib/money";
import { PayPalError, captureOrder, getOrder, type PayPalOrder } from "@/lib/paypal";
import { getSale, getStallById, markSalePaid } from "@/lib/store";

export const dynamic = "force-dynamic";

function completedCapture(order: PayPalOrder) {
  return order.purchase_units?.[0]?.payments?.captures?.find((c) => c.status === "COMPLETED") ?? null;
}

/** POST after the buyer approves in the PayPal popup. Marks the sale PAID only on PayPal's word. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await ctx.params;
    if (!/^[A-Z0-9]{10,32}$/.test(orderId)) return fail("That is not a PayPal order id.");
    const sale = await getDb().query.sales.findFirst({ where: eq(schema.sales.paypalOrderId, orderId), with: { items: true } });
    if (!sale) return fail("We have no cart for that PayPal order.", 404);

    let order: PayPalOrder;
    if (sale.status === "PAID") {
      order = (await getOrder(orderId)).data; // already captured (double tap, or the webhook won the race)
    } else {
      try {
        order = (await captureOrder(orderId, sale.id)).data;
      } catch (err) {
        const issue = (err as PayPalError)?.body as { details?: { issue?: string }[] } | undefined;
        if (err instanceof PayPalError && issue?.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED") {
          order = (await getOrder(orderId)).data;
        } else if (err instanceof PayPalError && issue?.details?.[0]?.issue === "INSTRUMENT_DECLINED") {
          return fail("PayPal declined that payment method. Choose another one in the PayPal window.", 402, { retry: true });
        } else {
          throw err;
        }
      }
    }

    const capture = completedCapture(order);
    if (!capture) return fail("PayPal has not completed this payment yet. Nothing was charged twice; check again in a moment.", 409);
    if (decimalToCents(capture.amount.value) !== sale.totalCents || capture.amount.currency_code !== sale.currency) {
      console.error("[capture] amount mismatch", sale.id, capture.amount, sale.totalCents);
      return fail("The amount PayPal captured does not match the cart. The owner has been told.", 409);
    }
    await markSalePaid(sale.id, capture.id, orderId);

    const [fresh, stall] = await Promise.all([getSale(sale.id), getStallById(sale.stallId)]);
    return NextResponse.json({
      saleId: sale.id,
      status: fresh?.status ?? "PAID",
      totalCents: sale.totalCents,
      tipCents: sale.tipCents,
      currency: sale.currency,
      thankYou: stall?.thankYou ?? "Thank you.",
      items: sale.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
    });
  } catch (err) {
    return failFrom(err);
  }
}
