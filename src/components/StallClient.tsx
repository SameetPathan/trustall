"use client";

import { useMemo, useRef, useState } from "react";
import PayPalButton, { type Receipt } from "./PayPalButton";
import { money, postJson, toJpegDataUrl } from "@/lib/client-image";
import { productIcon } from "@/lib/icons";
import { SAMPLE_BASKETS } from "@/lib/samples";

interface CatalogItem {
  id: string;
  name: string;
  unit: string;
  priceCents: number;
}
interface Line {
  productId: string;
  quantity: number;
  confidence: number | null;
  edited: boolean;
}
interface VisionResponse {
  lines: { productId: string; quantity: number; confidence: number }[];
  unrecognised: string[];
  photoId: string | null;
  fallback?: boolean;
  message?: string;
}

const FLAG_BELOW = 0.75;
const MAX_QTY = 20;
const TIPS = [0, 100, 200];

type Step = "start" | "looking" | "cart" | "receipt" | "invoiced";

export default function StallClient(props: {
  stall: { slug: string; name: string; currency: string; thankYou: string };
  catalog: CatalogItem[];
  paypalClientId: string | null;
  showSamples: boolean;
}) {
  const { stall, catalog } = props;
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const fmt = (c: number) => money(c, stall.currency);

  const [step, setStep] = useState<Step>("start");
  const [lines, setLines] = useState<Line[]>([]);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unrecognised, setUnrecognised] = useState<string[]>([]);
  const [tipCents, setTipCents] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [typing, setTyping] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [invoice, setInvoice] = useState<{ email: string; totalCents: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const itemsTotal = lines.reduce((a, l) => a + (byId.get(l.productId)?.priceCents ?? 0) * l.quantity, 0);
  const total = itemsTotal + (lines.length ? tipCents : 0);

  const payload = () => ({
    slug: stall.slug,
    photoId,
    tipCents: lines.length ? tipCents : 0,
    lines: lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      aiConfidence: l.confidence,
      editedByCustomer: l.edited,
    })),
  });
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  function mergeLines(incoming: Line[]) {
    setLines((current) => {
      const next = [...current];
      for (const line of incoming) {
        if (!byId.has(line.productId)) continue;
        const i = next.findIndex((l) => l.productId === line.productId);
        if (i >= 0) next[i] = { ...next[i], quantity: Math.min(MAX_QTY, next[i].quantity + line.quantity), edited: true };
        else next.push(line);
      }
      return next;
    });
  }

  async function look(source: File | string) {
    setError(null);
    setNotice(null);
    setPreview(null);
    setStep("looking");
    try {
      const image = await toJpegDataUrl(source);
      setPreview(image);
      const res = await postJson<VisionResponse>("/api/vision/cart", { slug: stall.slug, image });
      if (!res.ok) {
        setNotice(res.data.error ?? "We could not read that photo. Pick your items from the list.");
        setLines([]);
        setPickerOpen(true);
      } else {
        setPhotoId(res.data.photoId);
        setUnrecognised(res.data.unrecognised ?? []);
        setLines(res.data.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, confidence: l.confidence, edited: false })));
        if (res.data.fallback || res.data.lines.length === 0) {
          setNotice(res.data.message ?? "We could not spot this stall's items in that photo. Pick them from the list.");
          setPickerOpen(true);
        }
      }
    } catch (err) {
      setNotice(err instanceof Error ? `${err.message} Pick your items from the list.` : "Pick your items from the list.");
      setLines([]);
      setPickerOpen(true);
    }
    setStep("cart");
  }

  function setQty(productId: string, quantity: number) {
    setLines((current) =>
      quantity <= 0
        ? current.filter((l) => l.productId !== productId)
        : current.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(MAX_QTY, quantity), edited: true } : l)),
    );
  }

  async function addTyped(e: React.FormEvent) {
    e.preventDefault();
    if (!typed.trim() || typing) return;
    setTyping(true);
    setError(null);
    const res = await postJson<VisionResponse>("/api/vision/cart", { slug: stall.slug, text: typed });
    setTyping(false);
    if (res.ok && res.data.lines.length > 0) {
      mergeLines(res.data.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, confidence: l.confidence, edited: true })));
      setTyped("");
      setPickerOpen(false);
      setNotice(null);
    } else {
      setError(res.data.message ?? res.data.error ?? "We could not match that. Tap the items in the list instead.");
    }
  }

  async function sendInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    const { tipCents: _noTipOnInvoices, ...body } = payload();
    const res = await postJson<{ email: string; totalCents: number }>("/api/paypal/invoice", { ...body, email });
    setSending(false);
    if (!res.ok) return setError(res.data.error ?? "The invoice could not be sent.");
    setInvoice({ email: res.data.email, totalCents: res.data.totalCents });
    setStep("invoiced");
  }

  function reset() {
    setLines([]);
    setPhotoId(null);
    setPreview(null);
    setNotice(null);
    setError(null);
    setUnrecognised([]);
    setTipCents(0);
    setPickerOpen(false);
    setInvoiceOpen(false);
    setReceipt(null);
    setInvoice(null);
    setStep("start");
  }

  const cameraInput = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      capture="environment"
      className="sr-only"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void look(file);
      }}
    />
  );

  // ---------- receipt ----------
  if (step === "receipt" && receipt) {
    const colors = ["#ffc531", "#ffffff", "#7be0ad", "#ff8fa3"];
    return (
      <main className="relative min-h-[calc(100dvh-2.25rem)] overflow-hidden bg-gradient-to-b from-leaf to-leaf-deep px-5 pb-12 pt-10 text-paper">
        <div className="confetti pointer-events-none absolute inset-0" aria-hidden>
          {Array.from({ length: 26 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: colors[i % colors.length],
                animationDuration: `${2.4 + (i % 5) * 0.45}s`,
                animationDelay: `${(i % 7) * 0.12}s`,
              }}
            />
          ))}
        </div>
        <div className="relative mx-auto max-w-md">
          <svg viewBox="0 0 72 72" className="h-24 w-24" aria-hidden>
            <circle cx="36" cy="36" r="30" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" className="check-circle" transform="rotate(-90 36 36)" />
            <path d="M22 37l10 10 19-21" fill="none" stroke="#ffc531" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="check-mark" />
          </svg>
          <h1 className="mt-5 text-5xl">Paid. Thank you!</h1>
          <p className="mt-3 text-lg text-paper/90">{receipt.thankYou}</p>
          <div className="slip rise mt-8 p-5 text-ink" style={{ "--i": 3 } as React.CSSProperties}>
            <p className="display text-xl">{stall.name}</p>
            <ul className="mt-4 space-y-2.5">
              {receipt.items.map((i) => (
                <li key={i.name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden>{productIcon(i.name)}</span>
                    {i.quantity} × {i.name}
                  </span>
                  <span className="tabular font-semibold">{money(i.quantity * i.unitPriceCents, receipt.currency)}</span>
                </li>
              ))}
              {receipt.tipCents > 0 && (
                <li className="flex justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden>💛</span>Tip
                  </span>
                  <span className="tabular font-semibold">{money(receipt.tipCents, receipt.currency)}</span>
                </li>
              )}
            </ul>
            <p className="mt-4 flex items-baseline justify-between border-t-2 border-dashed border-line pt-4 font-bold">
              <span>Paid with PayPal</span>
              <span className="display tabular text-3xl">{money(receipt.totalCents, receipt.currency)}</span>
            </p>
          </div>
          <button onClick={reset} className="btn-plain mt-8 w-full">
            Buy something else
          </button>
        </div>
      </main>
    );
  }

  if (step === "invoiced" && invoice) {
    return (
      <main className="hero min-h-[calc(100dvh-2.25rem)] px-5 pb-12 pt-12">
        <div className="mx-auto max-w-md">
          <p className="text-6xl" aria-hidden>
            📬
          </p>
          <h1 className="mt-5 text-5xl">Invoice sent</h1>
          <p className="mt-4 text-lg text-chalk/90">
            PayPal has emailed an invoice for <strong className="text-yolk">{fmt(invoice.totalCents)}</strong> to{" "}
            <strong className="break-all">{invoice.email}</strong>. Take your things, and pay it when you are home.
          </p>
          <button onClick={reset} className="btn-sign mt-8 w-full">
            Done
          </button>
        </div>
      </main>
    );
  }

  // ---------- start ----------
  if (step === "start" || step === "looking") {
    return (
      <main className="pb-14">
        <header className="hero rounded-b-[2rem] px-5 pb-9 pt-8">
          <div className="mx-auto max-w-md">
            <p className="pill bg-white/12 text-chalk">Honesty stall</p>
            <h1 className="mt-3 text-4xl">{stall.name}</h1>
            {step === "start" && <p className="mt-3 text-lg text-chalk/85">Take one photo of everything you are taking. We add it up for you.</p>}
          </div>
        </header>

        <div className="mx-auto max-w-md px-5">
          {step === "looking" ? (
            <div className="card -mt-5 overflow-hidden" role="status" aria-live="polite">
              <div className="scan aspect-[4/3] bg-board-2">
                {preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-6 text-center">
                <p className="display text-2xl">Looking at your basket</p>
                <p className="dots mt-3 text-yolk-deep" aria-hidden>
                  <i />
                  <i />
                  <i />
                </p>
                <p className="mt-2 text-moss">This takes a few seconds.</p>
              </div>
            </div>
          ) : (
            <>
              {cameraInput}
              <button className="btn-sign pulse -mt-7 w-full !min-h-[4.5rem] text-xl" onClick={() => fileInput.current?.click()}>
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                Snap what you&apos;re taking
              </button>
              <button
                className="mt-4 w-full py-2 font-bold text-moss underline decoration-2 underline-offset-4"
                onClick={() => {
                  setPickerOpen(true);
                  setStep("cart");
                }}
              >
                Pick from the price list instead
              </button>

              {props.showSamples && (
                <section className="mt-8">
                  <h2 className="text-2xl">No stall in front of you?</h2>
                  <p className="mt-1 text-moss">Tap a sample basket to try it.</p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {SAMPLE_BASKETS.map((s, i) => (
                      <button
                        key={s.src}
                        onClick={() => void look(s.src)}
                        className="card rise overflow-hidden text-left transition-transform hover:-translate-y-1"
                        style={{ "--i": i } as React.CSSProperties}
                        aria-label={`Use sample basket ${i + 1}: ${s.label}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.src} alt="" className="aspect-square w-full object-cover" />
                        <span className="block px-2.5 py-2 text-sm font-bold">Basket {i + 1}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-10">
                <h2 className="text-2xl">Today&apos;s prices</h2>
                <ul className="card mt-4 divide-y divide-line px-4">
                  {catalog.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-3">
                      <span className="icon-tile" aria-hidden>
                        {productIcon(p.name)}
                      </span>
                      <span className="flex-1 leading-tight">
                        <span className="font-bold">{p.name}</span>
                        <span className="block text-sm text-moss">{p.unit}</span>
                      </span>
                      <span className="tabular font-bold">{fmt(p.priceCents)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </main>
    );
  }

  // ---------- cart ----------
  const notInCart = catalog.filter((p) => !lines.some((l) => l.productId === p.id));
  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-6">
      <div className="flex items-center gap-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Your photo" className="h-14 w-14 rounded-2xl object-cover shadow-[var(--shadow-card)]" />
        )}
        <div>
          <p className="text-sm font-bold text-moss">{stall.name}</p>
          <h1 className="text-3xl">Is this what you took?</h1>
        </div>
      </div>

      {notice && (
        <p className="card-note mt-4 p-3.5" role="status">
          {notice}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {lines.length === 0 ? (
          <p className="card-empty p-5 text-moss">Nothing in your cart yet. Add what you are taking from the list below.</p>
        ) : (
          lines.map((l, index) => {
            const p = byId.get(l.productId)!;
            const check = !l.edited && l.confidence !== null && l.confidence < FLAG_BELOW;
            return (
              <div key={l.productId} className={`card rise p-3.5 ${check ? "ring-2 ring-beet/60" : ""}`} style={{ "--i": index } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <span className="icon-tile" aria-hidden>
                    {productIcon(p.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-tight">{p.name}</p>
                    <p className="text-sm text-moss">
                      {p.unit}, {fmt(p.priceCents)} each
                    </p>
                  </div>
                  <p className="display tabular text-xl">{fmt(p.priceCents * l.quantity)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-full bg-whitewash p-1">
                    <button
                      className="grid h-10 w-10 place-items-center rounded-full bg-paper text-xl font-bold shadow-sm"
                      aria-label={l.quantity === 1 ? `Remove ${p.name}` : `One fewer ${p.name}`}
                      onClick={() => setQty(l.productId, l.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="tabular w-10 text-center text-lg font-bold" aria-live="polite">
                      {l.quantity}
                    </span>
                    <button
                      className="grid h-10 w-10 place-items-center rounded-full bg-ink text-xl font-bold text-paper disabled:opacity-30"
                      aria-label={`One more ${p.name}`}
                      disabled={l.quantity >= MAX_QTY}
                      onClick={() => setQty(l.productId, l.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  {check && <span className="pill bg-beet text-paper">Check this one</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {unrecognised.length > 0 && (
        <p className="mt-3 text-sm text-moss">
          Not on this stall&apos;s price list, so not added: {unrecognised.join("; ")}.
        </p>
      )}

      <section className="mt-4">
        <button className="btn-plain w-full" aria-expanded={pickerOpen} onClick={() => setPickerOpen((v) => !v)}>
          {pickerOpen ? "Close the list" : "+ Add a missed item"}
        </button>
        {pickerOpen && (
          <div className="card mt-3 p-4">
            {notInCart.length === 0 ? (
              <p className="text-moss">Everything on the price list is already in your cart.</p>
            ) : (
              <ul className="divide-y divide-line">
                {notInCart.map((p) => (
                  <li key={p.id}>
                    <button
                      className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
                      onClick={() => mergeLines([{ productId: p.id, quantity: 1, confidence: null, edited: true }])}
                    >
                      <span className="icon-tile" aria-hidden>
                        {productIcon(p.name)}
                      </span>
                      <span className="flex-1 leading-tight">
                        <span className="font-bold">{p.name}</span>
                        <span className="block text-sm text-moss">{p.unit}</span>
                      </span>
                      <span className="tabular font-bold">{fmt(p.priceCents)}</span>
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-yolk font-bold" aria-hidden>
                        +
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addTyped} className="mt-3 border-t border-line pt-4">
              <label htmlFor="typed" className="text-sm font-bold">
                Or type what you took
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="typed"
                  className="field"
                  placeholder="2 dozen eggs and a honey"
                  value={typed}
                  maxLength={300}
                  onChange={(e) => setTyped(e.target.value)}
                />
                <button className="btn-plain shrink-0" disabled={typing || !typed.trim()}>
                  {typing ? "Adding…" : "Add"}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {lines.length > 0 && (
        <section className="card mt-5 p-4">
          <p className="text-sm font-bold">Add a tip for the stall?</p>
          <div className="mt-2 flex gap-2">
            {TIPS.map((t) => (
              <button key={t} onClick={() => setTipCents(t)} aria-pressed={tipCents === t} className="seg flex-1">
                {t === 0 ? "No tip" : fmt(t)}
              </button>
            ))}
          </div>
          <p className="mt-4 flex items-baseline justify-between border-t-2 border-dashed border-line pt-4 font-bold">
            <span className="text-lg">Total</span>
            <span className="display tabular text-4xl">{fmt(total)}</span>
          </p>
        </section>
      )}

      {error && (
        <p className="card-alert mt-4 p-3.5 font-bold text-beet" role="alert">
          {error}
        </p>
      )}

      <section className="mt-5">
        <PayPalButton
          clientId={props.paypalClientId}
          currency={stall.currency}
          getOrderPayload={() => payloadRef.current()}
          disabled={lines.length === 0}
          onPaid={(r) => {
            setReceipt(r);
            setStep("receipt");
            window.scrollTo(0, 0);
          }}
          onError={(m) => setError(m)}
        />

        {!invoiceOpen ? (
          <button
            className="mt-3 w-full py-2 font-bold text-moss underline decoration-2 underline-offset-4 disabled:opacity-40"
            disabled={lines.length === 0}
            onClick={() => setInvoiceOpen(true)}
          >
            No wallet on you? Invoice me
          </button>
        ) : (
          <form onSubmit={sendInvoice} className="card mt-4 p-4">
            <label htmlFor="email" className="font-bold">
              Where should PayPal send the invoice?
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              className="field mt-2"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="mt-2 text-sm text-moss">
              The invoice is for {fmt(itemsTotal)}. Your email is used for this invoice only.
            </p>
            <button className="btn-sign mt-3 w-full" disabled={sending || lines.length === 0}>
              {sending ? "Sending invoice…" : "Send invoice"}
            </button>
          </form>
        )}
      </section>

      {cameraInput}
      <div className="mt-8 flex justify-between text-sm">
        <button className="font-bold text-moss underline decoration-2 underline-offset-4" onClick={() => fileInput.current?.click()}>
          Retake the photo
        </button>
        <button className="font-bold text-moss underline decoration-2 underline-offset-4" onClick={reset}>
          Start over
        </button>
      </div>
    </main>
  );
}
