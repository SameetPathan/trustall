import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StallClient from "@/components/StallClient";
import { publicPayPalClientId } from "@/lib/env";
import { getCatalog, getStallBySlug } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const stall = await getStallBySlug((await params).slug);
  return { title: stall ? `${stall.name}: pay with Trustall` : "Stall not found" };
}

export default async function StallPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const stall = await getStallBySlug(slug);
  if (!stall) notFound();
  const catalog = await getCatalog(stall.id);
  return (
    <StallClient
      stall={{ slug: stall.slug, name: stall.name, currency: stall.currency, thankYou: stall.thankYou }}
      catalog={catalog.map((p) => ({ id: p.id, name: p.name, unit: p.unit, priceCents: p.priceCents }))}
      paypalClientId={publicPayPalClientId()}
      showSamples={stall.slug === "meadow-lane"}
    />
  );
}
