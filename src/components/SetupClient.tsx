"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { postJson, toJpegDataUrl } from "@/lib/client-image";
import { SAMPLE_PRICE_BOARD } from "@/lib/samples";

interface Row {
  key: number;
  name: string;
  unit: string;
  price: string;
}

let nextKey = 1;
const blank = (): Row => ({ key: nextKey++, name: "", unit: "each", price: "" });

function priceToCents(input: string): number | null {
  const m = /^\s*\$?\s*(\d{1,5})(?:\.(\d{1,2}))?\s*$/.exec(input);
  if (!m) return null;
  return Number(m[1]) * 100 + (m[2] ? Number(m[2].padEnd(2, "0")) : 0);
}

export default function SetupClient() {
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [board, setBoard] = useState<string | null>(null);
  const [stallPhoto, setStallPhoto] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [drafted, setDrafted] = useState(false);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boardInput = useRef<HTMLInputElement>(null);
  const stallInput = useRef<HTMLInputElement>(null);

  async function pick(source: File | string, target: "board" | "stall") {
    setError(null);
    try {
      const url = await toJpegDataUrl(source, 1568);
      if (target === "board") setBoard(url);
      else setStallPhoto(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That picture could not be opened.");
    }
  }

  async function readBoard() {
    if (!board) return setError("Add a photo of your price board first.");
    setBusy("reading");
    setError(null);
    const res = await postJson<{ products: { name: string; unit: string; priceCents: number | null }[] }>("/api/vision/catalog", {
      images: [board, stallPhoto].filter(Boolean),
    });
    setBusy(null);
    setDrafted(true);
    if (!res.ok) {
      setError(res.data.error ?? "We could not read the price board. Add your products by hand.");
      if (rows.length === 0) setRows([blank()]);
      return;
    }
    setRows(
      res.data.products.map((p) => ({
        key: nextKey++,
        name: p.name,
        unit: p.unit,
        price: p.priceCents === null ? "" : (p.priceCents / 100).toFixed(2),
      })),
    );
    if (res.data.products.length === 0) {
      setError("No products found in that photo. Add them by hand below.");
      setRows([blank()]);
    }
  }

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const products = [];
    for (const r of rows) {
      if (!r.name.trim()) continue;
      const cents = priceToCents(r.price);
      if (!cents) return setError(`Set a price for ${r.name.trim()}, like 4.50.`);
      products.push({ name: r.name.trim(), unit: r.unit.trim() || "each", priceCents: cents });
    }
    if (products.length === 0) return setError("Add at least one product with a price.");
    setBusy("saving");
    setError(null);
    const res = await postJson<{ slug: string }>("/api/owner/setup", { name, ownerEmail, passcode, products });
    if (!res.ok) {
      setBusy(null);
      return setError(res.data.error ?? "The stall could not be saved.");
    }
    window.location.href = "/owner/sign";
  }

  const photoSlot = (label: string, hint: string, value: string | null, input: React.RefObject<HTMLInputElement | null>, target: "board" | "stall") => (
    <div>
      <p className="font-bold">{label}</p>
      <p className="text-sm text-moss">{hint}</p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pick(f, target);
        }}
      />
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={`${label} preview`} className="card mt-2 max-h-56 w-full object-contain" />
      ) : null}
      <button type="button" className="btn-plain mt-2 w-full" onClick={() => input.current?.click()}>
        {value ? "Choose a different photo" : "Choose a photo"}
      </button>
    </div>
  );

  return (
    <main className="owner-entry mx-auto max-w-xl px-5 pb-16 pt-8">
      <p>
        <Link href="/" className="font-bold underline decoration-2 underline-offset-4">
          Trustall
        </Link>
      </p>
      <h1 className="mt-3 text-5xl">Set up your stall</h1>
      <p className="mt-3">Photograph your price board. We draft the price list, you check it, then you print the sign.</p>

      <form onSubmit={save} className="mt-8 space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="text-2xl">1. Your stall</h2>
          <div>
            <label htmlFor="name" className="font-bold">
              Stall name
            </label>
            <input id="name" className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} placeholder="Meadow Lane Eggs & Honey" />
          </div>
          <div>
            <label htmlFor="ownerEmail" className="font-bold">
              PayPal email for the stall
            </label>
            <input id="ownerEmail" type="email" className="field mt-1" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
            <p className="mt-1 text-sm text-moss">
              In this sandbox demo every stall is paid into the demo&apos;s PayPal sandbox business account. The email is kept as your contact.
            </p>
          </div>
          <div>
            <label htmlFor="newpass" className="font-bold">
              Choose an owner passcode
            </label>
            <input id="newpass" type="password" className="field mt-1" value={passcode} onChange={(e) => setPasscode(e.target.value)} required minLength={6} autoComplete="new-password" />
            <p className="mt-1 text-sm text-moss">At least 6 characters. You need it to open your ledger.</p>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-2xl">2. Photos</h2>
          {photoSlot("Price board", "The sign that lists what you sell and what it costs.", board, boardInput, "board")}
          <button type="button" className="font-bold underline decoration-2 underline-offset-4" onClick={() => void pick(SAMPLE_PRICE_BOARD, "board")}>
            No board to hand? Use the sample price board
          </button>
          {photoSlot("The stall (optional)", "Helps when the board leaves something out.", stallPhoto, stallInput, "stall")}
          <button type="button" className="btn-sign w-full" onClick={readBoard} disabled={busy !== null || !board}>
            {busy === "reading" ? "Reading your price board…" : "Draft my price list"}
          </button>
          {!drafted && (
            <button
              type="button"
              className="font-bold underline decoration-2 underline-offset-4"
              onClick={() => {
                setDrafted(true);
                if (rows.length === 0) setRows([blank()]);
              }}
            >
              Skip the photo and type the list
            </button>
          )}
        </section>

        {drafted && (
          <section className="card p-5">
            <h2 className="text-2xl">3. Check the price list</h2>
            <p className="mt-2 text-moss">These prices are what customers are charged. Fix anything the photo got wrong.</p>
            <ul className="mt-4 space-y-3">
              {rows.map((r) => (
                <li key={r.key} className="rounded-2xl bg-whitewash p-3.5">
                  <label className="text-sm font-bold" htmlFor={`n${r.key}`}>
                    Product
                  </label>
                  <input id={`n${r.key}`} className="field mt-1" value={r.name} maxLength={60} onChange={(e) => update(r.key, { name: e.target.value })} />
                  <div className="mt-2 grid grid-cols-[1fr_7rem_auto] items-end gap-2">
                    <div>
                      <label className="text-sm font-bold" htmlFor={`u${r.key}`}>
                        Sold per
                      </label>
                      <input id={`u${r.key}`} className="field mt-1" value={r.unit} maxLength={30} onChange={(e) => update(r.key, { unit: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-bold" htmlFor={`p${r.key}`}>
                        Price ($)
                      </label>
                      <input
                        id={`p${r.key}`}
                        className={`field tabular mt-1 ${r.name.trim() && !priceToCents(r.price) ? "border-beet" : ""}`}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={r.price}
                        onChange={(e) => update(r.key, { price: e.target.value })}
                      />
                    </div>
                    <button type="button" className="btn-plain" aria-label={`Remove ${r.name || "this product"}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-plain mt-3 w-full" onClick={() => setRows((rs) => [...rs, blank()])} disabled={rows.length >= 30}>
              Add a product
            </button>
          </section>
        )}

        {error && (
          <p className="card-alert p-3 font-bold text-beet" role="alert">
            {error}
          </p>
        )}

        {drafted && (
          <button className="btn-sign w-full" disabled={busy !== null}>
            {busy === "saving" ? "Saving your stall…" : "Save stall and make my sign"}
          </button>
        )}
      </form>
    </main>
  );
}
