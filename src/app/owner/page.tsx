import { redirect } from "next/navigation";
import OwnerDashboard from "@/components/OwnerDashboard";
import { getOwnerStall } from "@/lib/auth";
import { getCatalog } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Owner view: Trustall" };

export default async function OwnerPage() {
  const stall = await getOwnerStall();
  if (!stall) redirect("/owner/login");
  const catalog = await getCatalog(stall.id);
  const has = (k: string) => Boolean(process.env[k]?.trim());
  return (
    <OwnerDashboard
      stall={{ slug: stall.slug, name: stall.name, currency: stall.currency }}
      catalog={catalog.map((p) => ({ id: p.id, name: p.name, unit: p.unit, priceCents: p.priceCents }))}
      isDemo={stall.slug === "meadow-lane"}
      setup={{
        paypal: has("PAYPAL_CLIENT_ID") && has("PAYPAL_CLIENT_SECRET"),
        webhook: has("PAYPAL_WEBHOOK_ID"),
        ai: has("AI_API_KEY") && has("AI_MODEL"),
      }}
    />
  );
}
