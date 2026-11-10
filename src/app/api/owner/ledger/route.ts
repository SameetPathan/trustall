import { NextResponse } from "next/server";
import { recentActions } from "@/lib/agent";
import { getOwnerStall } from "@/lib/auth";
import { fail, failFrom } from "@/lib/http";
import { getLedger, getShelfStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Everything the owner dashboard polls for: sales, shelf status, and the agent's action log. */
export async function GET() {
  try {
    const stall = await getOwnerStall();
    if (!stall) return fail("Sign in as the stall owner first.", 401);
    const [sales, shelf, actions] = await Promise.all([
      getLedger(stall.id, { limit: 200 }),
      getShelfStatus(stall.id),
      recentActions(stall.id, 15),
    ]);
    return NextResponse.json({
      sales,
      shelf,
      actions: actions.map((a) => ({
        id: a.id,
        tool: a.tool,
        summary: a.summary,
        status: a.status,
        paypalDebugId: a.paypalDebugId,
        message: (a.resultJson as { message?: string } | null)?.message ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    return failFrom(err);
  }
}
