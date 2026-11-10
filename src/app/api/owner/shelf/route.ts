import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerStall } from "@/lib/auth";
import { fail, failFrom } from "@/lib/http";
import { getCatalog, getShelfStatus, saveShelfCount } from "@/lib/store";

export const dynamic = "force-dynamic";

const bodyZod = z.object({
  kind: z.enum(["OPEN", "CLOSE"]),
  photoId: z.string().nullable().optional(),
  items: z.array(z.object({ productId: z.string(), units: z.number().int().min(0).max(500) })).min(1),
});

/** Saves counts the owner has confirmed. */
export async function POST(req: Request) {
  try {
    const stall = await getOwnerStall();
    if (!stall) return fail("Sign in as the stall owner first.", 401);
    const parsed = bodyZod.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Counts must be whole numbers from 0 to 500.");
    const known = new Set((await getCatalog(stall.id)).map((p) => p.id));
    const items = parsed.data.items.filter((i) => known.has(i.productId));
    if (items.length === 0) return fail("None of those products belong to this stall.");
    await saveShelfCount({ stallId: stall.id, kind: parsed.data.kind, photoId: parsed.data.photoId ?? null, items });
    return NextResponse.json({ shelf: await getShelfStatus(stall.id) });
  } catch (err) {
    return failFrom(err);
  }
}
