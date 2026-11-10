import { NextResponse } from "next/server";
import { AiParseError, ImageError, parseDataUrl, shelfFromPhoto } from "@/lib/ai";
import { getOwnerStall } from "@/lib/auth";
import { fail, failFrom } from "@/lib/http";
import { getCatalog, savePhoto } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { image } -> suggested unit counts. The owner confirms them before anything is saved. */
export async function POST(req: Request) {
  try {
    const stall = await getOwnerStall();
    if (!stall) return fail("Sign in as the stall owner first.", 401);
    const body = (await req.json().catch(() => null)) as { image?: string } | null;
    const catalog = (await getCatalog(stall.id)).map((p) => ({ id: p.id, name: p.name, unit: p.unit }));
    try {
      const image = parseDataUrl(body?.image);
      const photoId = await savePhoto(stall.id, image.mime, image.base64);
      const counts = await shelfFromPhoto(catalog, image);
      return NextResponse.json({ counts, photoId });
    } catch (err) {
      if (err instanceof ImageError) return fail(err.message, 400);
      if (err instanceof AiParseError) return fail("We could not count that photo. Enter the counts by hand.", 422);
      throw err;
    }
  } catch (err) {
    return failFrom(err);
  }
}
