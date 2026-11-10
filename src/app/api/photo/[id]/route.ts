import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getOwnerStall } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Customer and shelf photos, visible to the stall's owner only. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const stall = await getOwnerStall();
  if (!stall) return new Response("Sign in as the stall owner first.", { status: 401 });
  const { id } = await ctx.params;
  const photo = await getDb().query.photos.findFirst({
    where: and(eq(schema.photos.id, id), eq(schema.photos.stallId, stall.id)),
  });
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(photo.dataBase64, "base64"), {
    headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=86400" },
  });
}
