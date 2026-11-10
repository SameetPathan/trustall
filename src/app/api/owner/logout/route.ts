import { NextResponse } from "next/server";
import { clearOwnerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearOwnerSession();
  return NextResponse.json({ ok: true });
}
