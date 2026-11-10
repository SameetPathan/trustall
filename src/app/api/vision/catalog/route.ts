import { NextResponse } from "next/server";
import { AiParseError, ImageError, catalogFromPhotos, parseDataUrl } from "@/lib/ai";
import { fail, failFrom } from "@/lib/http";
import { allow, clientKey } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { images: dataUrl[] } -> draft products for the owner to confirm. Nothing is saved here. */
export async function POST(req: Request) {
  try {
    if (!allow(clientKey(req, "vision-catalog"), 6)) return fail("Too many tries in a minute. Wait a moment.", 429);
    const body = (await req.json().catch(() => null)) as { images?: unknown[] } | null;
    const inputs = Array.isArray(body?.images) ? body.images.slice(0, 2) : [];
    if (inputs.length === 0) return fail("Add a photo of the price board.");
    try {
      const products = await catalogFromPhotos(inputs.map(parseDataUrl));
      return NextResponse.json({ products });
    } catch (err) {
      if (err instanceof ImageError) return fail(err.message, 400);
      if (err instanceof AiParseError) return fail("We could not read that price board. Add your products by hand below.", 422);
      throw err;
    }
  } catch (err) {
    return failFrom(err);
  }
}
