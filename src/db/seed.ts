import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";
import { hashPasscode } from "../lib/passcode";

export const DEMO_SLUG = "meadow-lane";

// Prices match the sample price board in public/samples/price-board.jpg.
const DEMO_PRODUCTS = [
  { id: "prod_eggs_dozen", name: "Eggs", unit: "dozen", priceCents: 500, lowStockAt: 2 },
  { id: "prod_eggs_half", name: "Eggs", unit: "half dozen", priceCents: 300, lowStockAt: 2 },
  { id: "prod_honey_340g", name: "Wildflower honey", unit: "340 g jar", priceCents: 800, lowStockAt: 2 },
  { id: "prod_jam_strawberry", name: "Strawberry jam", unit: "250 g jar", priceCents: 600, lowStockAt: 2 },
  { id: "prod_sourdough", name: "Sourdough loaf", unit: "loaf", priceCents: 700, lowStockAt: 1 },
  { id: "prod_tomatoes_bag", name: "Tomatoes", unit: "1 lb bag", priceCents: 400, lowStockAt: 2 },
  { id: "prod_zucchini", name: "Zucchini", unit: "each", priceCents: 300, lowStockAt: 3 },
  { id: "prod_sunflowers", name: "Sunflowers", unit: "bunch", priceCents: 1000, lowStockAt: 1 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  const passcode = process.env.OWNER_DEMO_PASSCODE;
  if (!passcode) {
    console.error("OWNER_DEMO_PASSCODE is not set. It protects the demo stall's owner view.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  const existing = await db.query.stalls.findFirst({ where: eq(schema.stalls.slug, DEMO_SLUG) });
  if (existing) {
    // Keep sales and counts; only keep the passcode in step with the environment.
    await db
      .update(schema.stalls)
      .set({ ownerPasscodeHash: hashPasscode(passcode) })
      .where(eq(schema.stalls.id, existing.id));
    // Keep the demo price list in step with this file (matches public/samples/price-board.jpg).
    for (const p of DEMO_PRODUCTS) {
      await db
        .update(schema.products)
        .set({ name: p.name, unit: p.unit, priceCents: p.priceCents })
        .where(eq(schema.products.id, p.id));
    }
    console.log(`Demo stall already exists (${DEMO_SLUG}); passcode and prices refreshed.`);
  } else {
    await db.insert(schema.stalls).values({
      id: "stall_meadow_lane",
      slug: DEMO_SLUG,
      name: "Meadow Lane Eggs & Honey",
      ownerEmail: process.env.DEMO_OWNER_EMAIL ?? "owner@meadowlane.example",
      ownerPasscodeHash: hashPasscode(passcode),
      currency: "USD",
      thankYou: "Thank you for being honest. See you next week!",
    });
    await db.insert(schema.products).values(
      DEMO_PRODUCTS.map((p, i) => ({ ...p, stallId: "stall_meadow_lane", currency: "USD", sort: i })),
    );
    await db.insert(schema.contacts).values({
      id: "contact_riverside_cafe",
      stallId: "stall_meadow_lane",
      name: "Riverside Cafe",
      email: process.env.DEMO_CAFE_EMAIL ?? "riverside-cafe@example.com",
    });
    console.log(`Seeded demo stall "${DEMO_SLUG}" with ${DEMO_PRODUCTS.length} products.`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
