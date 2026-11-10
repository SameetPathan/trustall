import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Says which parts are configured, without revealing any value. */
export function GET() {
  const has = (k: string) => Boolean(process.env[k]?.trim());
  return NextResponse.json({
    ok: true,
    sandbox: true,
    configured: {
      database: has("DATABASE_URL"),
      paypal: has("PAYPAL_CLIENT_ID") && has("PAYPAL_CLIENT_SECRET"),
      webhook: has("PAYPAL_WEBHOOK_ID"),
      ai: has("AI_API_KEY") && has("AI_MODEL"),
    },
  });
}
