"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AgentTab from "./AgentTab";
import LedgerTab from "./LedgerTab";
import ShelfTab from "./ShelfTab";
import { postJson } from "@/lib/client-image";

export interface CatalogItem {
  id: string;
  name: string;
  unit: string;
  priceCents: number;
}
export interface LedgerSale {
  id: string;
  status: "PAID" | "INVOICED" | "REFUNDED";
  totalCents: number;
  tipCents: number;
  currency: string;
  source: string;
  customerEmail: string | null;
  createdAt: string;
  photoId: string | null;
  items: { productId: string; name: string; quantity: number; unitPriceCents: number; aiConfidence: number | null; editedByCustomer: boolean }[];
}
export interface HonestyRow {
  productId: string;
  name: string;
  open: number;
  close: number;
  paid: number;
  gone: number;
  covered: number;
  unpaidUnits: number;
  gapCents: number;
}
export interface ShelfStatus {
  open: { takenAt: string; counts: Record<string, number> } | null;
  close: { takenAt: string; counts: Record<string, number> } | null;
  honesty: { rows: HonestyRow[]; unitsGone: number; unitsPaid: number; unpaidUnits: number; gapCents: number; rate: number | null } | null;
  lowStock: { productId: string; name: string; unit: string; estimated: number; lowStockAt: number }[];
}
export interface ActionLog {
  id: string;
  tool: string;
  summary: string;
  status: string;
  paypalDebugId: string | null;
  message: string | null;
  createdAt: string;
}
export interface DashboardData {
  sales: LedgerSale[];
  shelf: ShelfStatus;
  actions: ActionLog[];
}

const TABS = [
  { id: "ledger", label: "Ledger" },
  { id: "shelf", label: "Shelf" },
  { id: "agent", label: "Assistant" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function OwnerDashboard(props: {
  stall: { slug: string; name: string; currency: string };
  catalog: CatalogItem[];
  isDemo: boolean;
  setup: { paypal: boolean; webhook: boolean; ai: boolean };
}) {
  const [tab, setTab] = useState<TabId>("ledger");
  const [data, setData] = useState<DashboardData | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/owner/ledger", { cache: "no-store" });
      if (res.status === 401) return void (window.location.href = "/owner/login");
      if (!res.ok) throw new Error();
      setData(await res.json());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  // Sales appear within a few seconds of PayPal confirming them.
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && void refresh(), 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  const missing = [
    !props.setup.paypal && "PayPal sandbox keys (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET): nobody can pay yet",
    !props.setup.webhook && "PAYPAL_WEBHOOK_ID: PayPal's webhooks will be rejected until it is set",
    !props.setup.ai && "AI_API_KEY and AI_MODEL: photos, the summary and the assistant are off; customers can still pick items by hand",
  ].filter(Boolean) as string[];

  const TAB_ICON: Record<TabId, string> = { ledger: "🧾", shelf: "📦", agent: "💬" };

  return (
    <div className="pb-20">
      <header className="hero rounded-b-[2rem] px-5 pb-16 pt-7">
        <div className="mx-auto flex max-w-3xl flex-wrap items-end justify-between gap-4">
          <div>
            <p className="pill bg-white/12 text-chalk">Owner view</p>
            <h1 className="mt-3 text-4xl">{props.stall.name}</h1>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-bold">
            <Link className="rounded-full bg-white/12 px-3.5 py-2 hover:bg-white/20" href={`/s/${props.stall.slug}`}>
              Customer page
            </Link>
            <Link className="rounded-full bg-white/12 px-3.5 py-2 hover:bg-white/20" href="/owner/sign">
              QR sign
            </Link>
            <button
              className="rounded-full bg-white/12 px-3.5 py-2 hover:bg-white/20"
              onClick={async () => {
                await postJson("/api/owner/logout", {});
                window.location.href = "/";
              }}
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4">
        <div role="tablist" aria-label="Owner sections" className="card -mt-8 flex gap-1 p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-3 font-bold transition-colors ${
                tab === t.id ? "bg-ink text-paper" : "text-moss hover:bg-whitewash"
              }`}
            >
              <span aria-hidden>{TAB_ICON[t.id]}</span>
              {t.label}
            </button>
          ))}
        </div>

        {missing.length > 0 && (
          <div className="card-alert mt-4 p-4 text-sm" role="status">
            <p className="font-bold text-beet">This server is not fully set up</p>
            <ul className="mt-1 list-disc pl-5">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {offline && (
          <p className="card-note mt-4 p-3.5 text-sm" role="status">
            Can not reach the server. Showing the last figures; retrying every few seconds.
          </p>
        )}

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
          {tab === "ledger" && <LedgerTab data={data} currency={props.stall.currency} slug={props.stall.slug} aiReady={props.setup.ai} />}
          {tab === "shelf" && (
            <ShelfTab data={data} catalog={props.catalog} currency={props.stall.currency} isDemo={props.isDemo} onSaved={refresh} />
          )}
          {tab === "agent" && <AgentTab actions={data?.actions ?? []} onChanged={refresh} aiReady={props.setup.ai} />}
        </div>
      </div>
    </div>
  );
}
