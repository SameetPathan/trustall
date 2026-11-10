import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgentTurn } from "@/lib/agent";
import { getOwnerStall } from "@/lib/auth";
import { fail, failFrom } from "@/lib/http";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodyZod = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(40),
});

/** POST { messages } -> { reply, actions }. Actions are proposals; nothing is sent to PayPal here. */
export async function POST(req: Request) {
  try {
    const stall = await getOwnerStall();
    if (!stall) return fail("Sign in as the stall owner first.", 401);
    if (!allow(`agent:${stall.id}`, 20)) return fail("Too many messages in a minute. Wait a moment.", 429);
    const parsed = bodyZod.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Send a message.");
    const messages = parsed.data.messages;
    if (messages[messages.length - 1].role !== "user") return fail("The last message must be yours.");
    // The API wants the first turn to be the user's.
    const firstUser = messages.findIndex((m) => m.role === "user");
    const result = await runAgentTurn(stall, messages.slice(firstUser));
    return NextResponse.json(result);
  } catch (err) {
    return failFrom(err);
  }
}
