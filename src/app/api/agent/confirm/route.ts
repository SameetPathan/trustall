import { NextResponse } from "next/server";
import { cancelAction, confirmAction } from "@/lib/agent";
import { getOwnerStall } from "@/lib/auth";
import { fail, failFrom } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { actionId, decision: "confirm" | "cancel" }. The only path to a PayPal write from the agent. */
export async function POST(req: Request) {
  try {
    const stall = await getOwnerStall();
    if (!stall) return fail("Sign in as the stall owner first.", 401);
    const body = (await req.json().catch(() => null)) as { actionId?: string; decision?: string } | null;
    if (!body?.actionId || (body.decision !== "confirm" && body.decision !== "cancel")) return fail("Missing action or decision.");
    const outcome =
      body.decision === "confirm" ? await confirmAction(stall, body.actionId) : await cancelAction(stall, body.actionId);
    return NextResponse.json(outcome);
  } catch (err) {
    return failFrom(err);
  }
}
