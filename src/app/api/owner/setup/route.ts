import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { setOwnerSession } from "@/lib/auth";
import { fail, failFrom } from "@/lib/http";
import { newId, slugify } from "@/lib/ids";
import { hashPasscode } from "@/lib/passcode";
import { allow, clientKey } from "@/lib/ratelimit";
import { getStallBySlug } from "@/lib/store";

export const dynamic = "force-dynamic";

const bodyZod = z.object({
  name: z.string().trim().min(2).max(60),
  ownerEmail: z.string().trim().email().max(254),
  passcode: z.string().min(6).max(72),
  products: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        unit: z.string().trim().min(1).max(30),
        priceCents: z.number().int().min(1).max(100_000),
      }),
    )
    .min(1)
    .max(30),
});

/** Creates a stall from the catalog the owner confirmed, and signs them in. */
export async function POST(req: Request) {
  try {
    if (!allow(clientKey(req, "setup"), 5)) return fail("Too many tries. Wait a minute.", 429);
    const parsed = bodyZod.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = String(first?.path[0] ?? "");
      const hints: Record<string, string> = {
        name: "Give the stall a name of 2 to 60 characters.",
        ownerEmail: "Enter the PayPal email for the stall.",
        passcode: "Choose a passcode of at least 6 characters.",
        products: "Every product needs a name, a unit and a price above zero.",
      };
      return fail(hints[field] ?? "Check the form and try again.");
    }
    const { name, ownerEmail, passcode, products } = parsed.data;

    const base = slugify(name) || "stall";
    let slug = base;
    for (let n = 2; await getStallBySlug(slug); n++) slug = `${base}-${n}`;

    const stallId = newId("stall");
    await getDb().transaction(async (tx) => {
      await tx.insert(schema.stalls).values({
        id: stallId,
        slug,
        name,
        ownerEmail,
        ownerPasscodeHash: hashPasscode(passcode),
        currency: "USD",
      });
      await tx.insert(schema.products).values(
        products.map((p, i) => ({
          id: newId("prod"),
          stallId,
          name: p.name,
          unit: p.unit,
          priceCents: p.priceCents,
          currency: "USD",
          sort: i,
        })),
      );
    });
    await setOwnerSession(stallId);
    return NextResponse.json({ slug });
  } catch (err) {
    return failFrom(err);
  }
}
