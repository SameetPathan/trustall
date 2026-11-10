import { NextResponse } from "next/server";
import { AiParseError, ImageError, cartFromPhoto, cartFromText, parseDataUrl, CONFIDENCE_FLAG } from "@/lib/ai";
import { MissingEnvError } from "@/lib/env";
import { fail, failFrom } from "@/lib/http";
import { allow, clientKey } from "@/lib/ratelimit";
import { getCatalog, getStallBySlug, savePhoto } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { slug, image? (data URL), text? } -> cart lines.
 * Never returns a price. When the model can not help, answers with
 * { fallback: true } so the page opens the catalog picker instead of failing.
 */
export async function POST(req: Request) {
  try {
    if (!allow(clientKey(req, "vision"), 20)) return fail("Too many photos in a minute. Wait a moment and try again.", 429);
    const body = (await req.json().catch(() => null)) as { slug?: string; image?: string; text?: string } | null;
    if (!body?.slug) return fail("Missing stall.");
    const stall = await getStallBySlug(body.slug);
    if (!stall) return fail("Stall not found.", 404);
    const catalog = (await getCatalog(stall.id)).map((p) => ({ id: p.id, name: p.name, unit: p.unit }));
    if (catalog.length === 0) return fail("This stall has no products yet.", 409);

    const fallback = (message: string) =>
      NextResponse.json({ lines: [], unrecognised: [], photoId: null, fallback: true, message });

    try {
      if (typeof body.text === "string" && body.text.trim()) {
        const cart = await cartFromText(catalog, body.text.trim());
        if (cart.lines.length === 0) return fallback("We could not match that to this stall's items. Pick them from the list.");
        return NextResponse.json({ ...cart, photoId: null, flagBelow: CONFIDENCE_FLAG });
      }
      const image = parseDataUrl(body.image);
      const photoId = await savePhoto(stall.id, image.mime, image.base64);
      const cart = await cartFromPhoto(catalog, image);
      if (cart.lines.length === 0) {
        return NextResponse.json({
          ...cart,
          photoId,
          fallback: true,
          message: "We could not spot this stall's items in that photo. Pick them from the list.",
        });
      }
      return NextResponse.json({ ...cart, photoId, flagBelow: CONFIDENCE_FLAG });
    } catch (err) {
      if (err instanceof ImageError) return fail(err.message, 400);
      if (err instanceof AiParseError) return fallback("We could not read that photo. Pick your items from the list.");
      if (err instanceof MissingEnvError) {
        return fallback(`Photo recognition is not set up on this server (${err.variable} is missing). Pick your items from the list.`);
      }
      console.error("[vision/cart]", err);
      return fallback("Photo recognition is not available right now. Pick your items from the list.");
    }
  } catch (err) {
    return failFrom(err);
  }
}
