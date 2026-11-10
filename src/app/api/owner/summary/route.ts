import { NextResponse } from "next/server";
import { dailySummary } from "@/lib/ai";
import { getOwnerStall } from "@/lib/auth";
import { fail, failFrom } from "@/lib/http";
import { formatMoney } from "@/lib/money";
import { allow } from "@/lib/ratelimit";
import { getLedger } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { since: ISO start of the owner's local day } -> one paragraph about today. Totals are computed here, not by the model. */
export async function POST(req: Request) {
  try {
    const stall = await getOwnerStall();
    if (!stall) return fail("Sign in as the stall owner first.", 401);
    if (!allow(`summary:${stall.id}`, 6)) return fail("Too many summaries in a minute. Wait a moment.", 429);
    const body = (await req.json().catch(() => null)) as { since?: string } | null;
    const since = body?.since ? new Date(body.since) : new Date(Date.now() - 24 * 3600_000);
    if (Number.isNaN(since.getTime())) return fail("Bad date.");
    const sales = await getLedger(stall.id, { since });
    const money = (c: number) => formatMoney(c, stall.currency);
    const paid = sales.filter((s) => s.status === "PAID");
    const units = new Map<string, number>();
    for (const s of paid) for (const i of s.items) units.set(i.name, (units.get(i.name) ?? 0) + i.quantity);
    const facts = {
      paidSales: paid.length,
      takings: money(paid.reduce((a, s) => a + s.totalCents, 0)),
      tips: money(paid.reduce((a, s) => a + s.tipCents, 0)),
      invoicesWaiting: sales.filter((s) => s.status === "INVOICED").length,
      invoicesWaitingValue: money(sales.filter((s) => s.status === "INVOICED").reduce((a, s) => a + s.totalCents, 0)),
      refunds: sales.filter((s) => s.status === "REFUNDED").length,
      unitsSoldByProduct: Object.fromEntries([...units.entries()].sort((a, b) => b[1] - a[1])),
      cartsCorrectedByCustomers: paid.filter((s) => s.items.some((i) => i.editedByCustomer)).length,
    };
    const summary = await dailySummary(stall.name, facts);
    return NextResponse.json({ summary });
  } catch (err) {
    return failFrom(err);
  }
}
