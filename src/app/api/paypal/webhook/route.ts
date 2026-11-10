import { NextResponse } from "next/server";
import { MissingEnvError } from "@/lib/env";
import { verifyWebhookSignature } from "@/lib/paypal";
import { dbWebhookStore } from "@/lib/store";
import { handleWebhookEvent, type PayPalWebhookEvent } from "@/lib/webhook";

export const dynamic = "force-dynamic";

/**
 * PayPal calls this. Every event is verified with PayPal's signature check
 * before it is trusted, and each event id is processed at most once.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }

  try {
    const verified = await verifyWebhookSignature(req.headers, raw);
    if (!verified) {
      console.warn("[webhook] signature check failed", event?.id, event?.event_type);
      return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof MissingEnvError) {
      console.error(`[webhook] ${err.message}`);
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[webhook] could not verify", err);
    return NextResponse.json({ error: "Could not verify with PayPal." }, { status: 502 }); // PayPal will retry
  }

  try {
    const outcome = await handleWebhookEvent(event, dbWebhookStore);
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    console.error("[webhook] processing failed", event.id, err);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 }); // PayPal will retry
  }
}
