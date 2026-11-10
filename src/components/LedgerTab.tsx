"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import type { DashboardData, LedgerSale } from "./OwnerDashboard";
import { money, postJson } from "@/lib/client-image";
import { productIcon } from "@/lib/icons";

const SalesGrid = dynamic(() => import("./SalesGrid"), {
  ssr: false,
  loading: () => <p className="card p-6 text-moss">Loading the sales grid…</p>,
});

const STATUS: Record<LedgerSale["status"], { label: string; className: string }> = {
  PAID: { label: "Paid", className: "bg-leaf/12 text-leaf-deep" },
  INVOICED: { label: "Invoiced", className: "bg-yolk/30 text-ink" },
  REFUNDED: { label: "Refunded", className: "bg-beet/10 text-beet" },
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = startOfToday();
  if (d >= today) return "Today";
  if (d >= new Date(today.getTime() - 86_400_000)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default function LedgerTab(props: { data: DashboardData | null; currency: string; slug: string; aiReady: boolean }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "cards">("grid");
  const fmt = (c: number) => money(c, props.currency);

  if (!props.data) return <p className="text-moss">Loading your ledger…</p>;
  const { sales, shelf } = props.data;

  const today = sales.filter((s) => new Date(s.createdAt) >= startOfToday());
  const paidToday = today.filter((s) => s.status === "PAID");
  const invoicedToday = today.filter((s) => s.status === "INVOICED");
  const refundedToday = today.filter((s) => s.status === "REFUNDED");
  const sum = (list: LedgerSale[]) => list.reduce((a, s) => a + s.totalCents, 0);

  const groups: { label: string; sales: LedgerSale[] }[] = [];
  for (const s of sales) {
    const label = dayLabel(s.createdAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.sales.push(s);
    else groups.push({ label, sales: [s] });
  }

  async function writeSummary() {
    setBusy(true);
    setError(null);
    const res = await postJson<{ summary: string }>("/api/owner/summary", { since: startOfToday().toISOString() });
    setBusy(false);
    if (res.ok) setSummary(res.data.summary);
    else setError(res.data.error ?? "The summary could not be written.");
  }

  return (
    <div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Paid today", value: sum(paidToday), note: `${paidToday.length} ${paidToday.length === 1 ? "sale" : "sales"}`, icon: "💰", tone: "card-dark text-chalk", sub: "text-chalk/75" },
          { label: "Invoices waiting", value: sum(invoicedToday), note: `${invoicedToday.length} today`, icon: "📬", tone: "card", sub: "text-moss" },
          { label: "Refunded", value: sum(refundedToday), note: `${refundedToday.length} today`, icon: "↩️", tone: "card", sub: "text-moss" },
        ].map((stat, i) => (
          <div key={stat.label} className={`${stat.tone} rise p-4`} style={{ "--i": i } as React.CSSProperties}>
            <dt className={`flex items-center justify-between text-sm font-bold ${stat.sub}`}>
              {stat.label}
              <span aria-hidden>{stat.icon}</span>
            </dt>
            <dd className="display tabular mt-2 text-4xl">{fmt(stat.value)}</dd>
            <dd className={`mt-1 text-sm ${stat.sub}`}>{stat.note}</dd>
          </div>
        ))}
      </dl>

      {shelf.lowStock.length > 0 && (
        <div className="mt-4 card-alert p-3" role="status">
          <p className="font-bold text-beet">Running low</p>
          <ul className="mt-1">
            {shelf.lowStock.map((l) => (
              <li key={l.productId}>
                {l.name} ({l.unit}): about {l.estimated} left
              </li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-moss">Estimated from your last shelf photo minus paid sales since.</p>
        </div>
      )}

      <div className="mt-4">
        {summary ? (
          <p className="card-note p-4"><span aria-hidden>✨ </span>{summary}</p>
        ) : (
          <button className="btn-plain" onClick={writeSummary} disabled={busy || !props.aiReady || today.length === 0}>
            {busy ? "Writing today's summary…" : "Write today's summary"}
          </button>
        )}
        {error && (
          <p className="mt-2 font-bold text-beet" role="alert">
            {error}
          </p>
        )}
      </div>

      {sales.length === 0 ? (
        <div className="card-empty mt-8 p-7 text-center">
          <h2 className="text-2xl">No sales yet</h2>
          <p className="mt-2">
            A sale appears here the moment PayPal confirms it. Open the customer page on your phone and buy
            something with a sandbox buyer account to see one arrive.
          </p>
          <Link href={`/s/${props.slug}`} className="btn-sign mt-4">
            Open the customer page
          </Link>
        </div>
      ) : (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl">All sales</h2>
            <div className="flex gap-1 rounded-full bg-paper p-1 shadow-[var(--shadow-card)]" role="group" aria-label="How to show sales">
              <button className="seg !min-h-9 px-4 !shadow-none" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
                Grid
              </button>
              <button className="seg !min-h-9 px-4 !shadow-none" aria-pressed={view === "cards"} onClick={() => setView("cards")}>
                Cards
              </button>
            </div>
          </div>
          {view === "grid" ? (
            <div className="mt-4">
              <SalesGrid sales={sales} currency={props.currency} />
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.label} className="mt-6">
                <h2 className="text-xl">{g.label}</h2>
                <ul className="mt-3 space-y-3">
                  {g.sales.map((s) => (
                    <li key={s.id} className="card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className={`pill ${STATUS[s.status].className}`}>
                            {STATUS[s.status].label}
                          </span>
                          <span className="ml-2 text-sm text-moss">
                            {new Date(s.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            {s.source === "AGENT" ? ", sent by the assistant" : ""}
                          </span>
                        </div>
                        <p className={`display tabular text-2xl ${s.status === "REFUNDED" ? "text-moss line-through" : ""}`}>{fmt(s.totalCents)}</p>
                      </div>
                      <ul className="mt-3 space-y-1">
                        {s.items.map((i) => (
                          <li key={i.productId} className="flex justify-between gap-3">
                            <span>
                              <span aria-hidden>{productIcon(i.name)} </span>
                              {i.quantity} × {i.name}
                              {i.editedByCustomer && <span className="text-sm text-moss"> (customer corrected)</span>}
                            </span>
                            <span className="tabular text-moss">{fmt(i.quantity * i.unitPriceCents)}</span>
                          </li>
                        ))}
                        {s.tipCents > 0 && (
                          <li className="flex justify-between gap-3">
                            <span>Tip</span>
                            <span className="tabular text-moss">{fmt(s.tipCents)}</span>
                          </li>
                        )}
                      </ul>
                      <p className="mt-2 text-sm text-moss">
                        {s.customerEmail ? `${s.customerEmail} · ` : ""}
                        {s.photoId ? (
                          <a className="underline underline-offset-2" href={`/api/photo/${s.photoId}`} target="_blank" rel="noreferrer">
                            See the customer&apos;s photo
                          </a>
                        ) : (
                          "No photo: picked from the list"
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </section>
      )}
    </div>
  );
}
