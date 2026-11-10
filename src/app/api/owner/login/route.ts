import { NextResponse } from "next/server";
import { setOwnerSession } from "@/lib/auth";
import { fail, failFrom } from "@/lib/http";
import { verifyPasscode } from "@/lib/passcode";
import { allow, clientKey } from "@/lib/ratelimit";
import { getStallBySlug } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!allow(clientKey(req, "login"), 10)) return fail("Too many tries. Wait a minute.", 429);
    const body = (await req.json().catch(() => null)) as { slug?: string; passcode?: string } | null;
    const stall = body?.slug ? await getStallBySlug(body.slug.trim().toLowerCase()) : null;
    if (!stall || !body?.passcode || !verifyPasscode(body.passcode, stall.ownerPasscodeHash)) {
      return fail("That stall and passcode do not match.", 401);
    }
    await setOwnerSession(stall.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failFrom(err);
  }
}
