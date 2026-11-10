import { NextResponse } from "next/server";
import { MissingEnvError } from "./env";
import { PayPalError } from "./paypal";
import { CartError } from "./cart";

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Turns any thrown error into a JSON response a person can act on. */
export function failFrom(err: unknown) {
  if (err instanceof CartError) return fail(err.message, 400);
  if (err instanceof MissingEnvError) return fail(err.message, 503, { missing: err.variable });
  if (err instanceof PayPalError) {
    console.error("[paypal]", err.status, err.debugId, JSON.stringify(err.body));
    return fail(err.message, 502, { paypalDebugId: err.debugId });
  }
  console.error(err);
  return fail("Something went wrong on our side. Try again in a moment.", 500);
}
