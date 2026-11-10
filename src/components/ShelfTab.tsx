"use client";

import { useRef, useState } from "react";
import type { CatalogItem, DashboardData } from "./OwnerDashboard";
import { money, postJson, toJpegDataUrl } from "@/lib/client-image";
import { SAMPLE_SHELVES } from "@/lib/samples";

type Kind = "OPEN" | "CLOSE";
const KIND_LABEL: Record<Kind, string> = { OPEN: "Morning", CLOSE: "Evening" };

const time = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

export default function ShelfTab(props: {
  data: DashboardData | null;
  catalog: CatalogItem[];
  currency: string;
  isDemo: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const shelf = props.data?.shelf ?? null;
  const [kind, setKind] = useState<Kind>("OPEN");
  const [counts, setCounts] = useState<Record<string, string> | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"counting" | "saving" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const blankCounts = () => Object.fromEntries(props.catalog.map((p) => [p.id, ""]));

  async function count(source: File | string) {
    setBusy("counting");
    setError(null);
    setSaved(null);
    try {
      const image = await toJpegDataUrl(source, 1568);
      const res = await postJson<{ counts: { productId: string; units: number }[]; photoId: string }>("/api/vision/shelf", { image });
      if (res.ok) {
        setPhotoId(res.data.photoId);
        setCounts(Object.fromEntries(res.data.counts.map((c) => [c.productId, String(c.units)])));
      } else {
        setError(res.data.error ?? "We could not count that photo. Enter the counts by hand.");
        setCounts((c) => c ?? blankCounts());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That picture could not be opened.");
    }
    setBusy(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!counts) return;
    const items = [];
    for (const p of props.catalog) {
      const raw = (counts[p.id] ?? "").trim();
      if (!/^\d{1,3}$/.test(raw)) return setError(`Enter a whole number for ${p.name} (${p.unit}). Use 0 if there are none.`);
      items.push({ productId: p.id, units: Number(raw) });
    }
    setBusy("saving");
    setError(null);
    const res = await postJson("/api/owner/shelf", { kind, photoId, items });
    setBusy(null);
    if (!res.ok) return setError(res.data.error ?? "The count could not be saved.");
    setCounts(null);
    setPhotoId(null);
    setSaved(`${KIND_LABEL[kind]} count saved.`);
    if (kind === "OPEN") setKind("CLOSE");
    await props.onSaved();
  }

  const h = shelf?.honesty ?? null;

  return (
    <div>
      <section className="card-dark p-6 text-chalk">
        <h2 className="text-xl">Honesty score</h2>
        {!shelf ? (
          <p className="mt-2">Loading…</p>
        ) : !shelf.open ? (
          <p className="mt-2">Add a morning photo of your shelf to start. An evening photo then gives you the score.</p>
        ) : !shelf.close ? (
          <>
            <p className="display mt-2 text-3xl">Add an evening photo</p>
            <p className="mt-2">Morning count taken {time(shelf.open.takenAt)}. The score appears once you count the shelf again.</p>
          </>
        ) : h && h.rate !== null ? (
          <div className="mt-3 flex flex-wrap items-center gap-6">
            <svg viewBox="0 0 120 120" className="h-36 w-36 flex-none" role="img" aria-label={`Honesty score ${Math.round(h.rate * 100)} percent`}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgb(255 255 255 / 0.14)" strokeWidth="12" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#ffc531"
                strokeWidth="12"
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
                strokeDasharray={314.16}
                strokeDashoffset={314.16 * (1 - h.rate)}
                className="gauge-arc"
                style={{ "--gauge-full": 314.16 } as React.CSSProperties}
              />
              <text x="60" y="68" textAnchor="middle" className="display" fontSize="30" fill="#fff">
                {Math.round(h.rate * 100)}%
              </text>
            </svg>
            <div className="min-w-48 flex-1">
              <p className="text-lg">
                <strong className="text-yolk">{h.unitsGone}</strong> {h.unitsGone === 1 ? "unit" : "units"} left the shelf,{" "}
                <strong className="text-yolk">{h.unitsPaid}</strong> {h.unitsPaid === 1 ? "was" : "were"} paid for.
              </p>
              <p className="mt-1">{h.unpaidUnits > 0 ? `The gap is worth ${money(h.gapCents, props.currency)}.` : "Nothing went unpaid."}</p>
              <p className="mt-2 text-sm text-chalk/70">
                {time(shelf.open.takenAt)} to {time(shelf.close.takenAt)}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-2">Nothing left the shelf between your two counts, so there is no score for this window.</p>
        )}
      </section>

      {h && h.rate !== null && (
        <div className="card mt-4 overflow-x-auto p-2">
          <table className="w-full text-left">
            <caption className="sr-only">Units by product between the morning and evening counts</caption>
            <thead>
              <tr className="border-b border-line text-sm text-moss">
                <th className="p-2 font-bold">Product</th>
                <th className="p-2 text-right font-bold">Morning</th>
                <th className="p-2 text-right font-bold">Evening</th>
                <th className="p-2 text-right font-bold">Gone</th>
                <th className="p-2 text-right font-bold">Paid</th>
                <th className="p-2 text-right font-bold">Unpaid</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {h.rows.map((r) => (
                <tr key={r.productId} className="border-b border-line last:border-0">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-right">{r.open}</td>
                  <td className="p-2 text-right">{r.close}</td>
                  <td className="p-2 text-right">{r.gone}</td>
                  <td className="p-2 text-right">{r.paid}</td>
                  <td className={`p-2 text-right font-bold ${r.unpaidUnits > 0 ? "text-beet" : ""}`}>{r.unpaidUnits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-2xl">Count the shelf</h2>
        <p className="mt-2 text-moss">Photograph the whole shelf. We count each product; you check the numbers before they are saved.</p>

        <fieldset className="mt-4">
          <legend className="font-bold">Which count is this?</legend>
          <div className="mt-2 flex gap-2">
            {(["OPEN", "CLOSE"] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className="seg flex-1"
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </fieldset>

        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void count(f);
          }}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-sign" onClick={() => input.current?.click()} disabled={busy !== null}>
            {busy === "counting" ? "Counting your shelf…" : `Take the ${KIND_LABEL[kind].toLowerCase()} photo`}
          </button>
          {props.isDemo && (
            <button className="btn-plain" onClick={() => void count(SAMPLE_SHELVES[kind])} disabled={busy !== null}>
              Use the sample {KIND_LABEL[kind].toLowerCase()} shelf
            </button>
          )}
          {!counts && (
            <button className="btn-plain" onClick={() => setCounts(blankCounts())} disabled={busy !== null}>
              Enter counts by hand
            </button>
          )}
        </div>

        {saved && (
          <p className="mt-3 font-bold text-leaf" role="status">
            {saved}
          </p>
        )}
        {error && (
          <p className="mt-3 card-alert p-3 font-bold text-beet" role="alert">
            {error}
          </p>
        )}

        {counts && (
          <form onSubmit={save} className="mt-5 card p-4">
            <h3 className="font-bold">Check the {KIND_LABEL[kind].toLowerCase()} count</h3>
            <ul className="mt-3 divide-y divide-line">
              {props.catalog.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <label htmlFor={`c-${p.id}`}>
                    {p.name} <span className="text-moss">({p.unit})</span>
                  </label>
                  <input
                    id={`c-${p.id}`}
                    className="field tabular !w-20 text-right"
                    inputMode="numeric"
                    value={counts[p.id] ?? ""}
                    onChange={(e) => setCounts({ ...counts, [p.id]: e.target.value })}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-3">
              <button className="btn-sign flex-1" disabled={busy !== null}>
                {busy === "saving" ? "Saving…" : `Save ${KIND_LABEL[kind].toLowerCase()} count`}
              </button>
              <button type="button" className="btn-plain" onClick={() => setCounts(null)}>
                Discard
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
