"use client";

import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/client-image";

export interface Receipt {
  saleId: string;
  totalCents: number;
  tipCents: number;
  currency: string;
  thankYou: string;
  items: { name: string; quantity: number; unitPriceCents: number }[];
}

type PayPalActions = { restart: () => Promise<void> };
type PayPalNamespace = {
  Buttons: (opts: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void>; close: () => Promise<void> };
};
declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

let sdkPromise: Promise<PayPalNamespace> | null = null;
function loadSdk(clientId: string, currency: string): Promise<PayPalNamespace> {
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture&components=buttons&disable-funding=card,paylater,venmo`;
      script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal did not load.")));
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error("PayPal did not load. Check your connection."));
      };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

/**
 * PayPal's own button. The order is created on our server from the cart the
 * customer is looking at, and nothing is charged until they approve it in PayPal.
 */
export default function PayPalButton(props: {
  clientId: string | null;
  currency: string;
  /** Read at click time, so the order always matches the cart on screen. */
  getOrderPayload: () => unknown;
  disabled: boolean;
  onPaid: (receipt: Receipt) => void;
  onError: (message: string) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (!props.clientId) return;
    let cancelled = false;
    let buttons: { close: () => Promise<void> } | null = null;
    loadSdk(props.clientId, props.currency)
      .then((paypal) => {
        if (cancelled || !holder.current) return;
        const instance = paypal.Buttons({
          style: { layout: "vertical", color: "gold", shape: "pill", label: "pay", height: 55 },
          createOrder: async () => {
            const res = await postJson<{ orderId: string }>("/api/paypal/orders", latest.current.getOrderPayload());
            if (!res.ok) throw new Error(res.data.error ?? "Could not start the payment.");
            return res.data.orderId;
          },
          onApprove: async (data: { orderID: string }, actions: PayPalActions) => {
            const res = await postJson<Receipt & { retry?: boolean }>(`/api/paypal/orders/${data.orderID}/capture`, {});
            if (res.status === 402 && res.data.retry) return actions.restart();
            if (!res.ok) return latest.current.onError(res.data.error ?? "The payment did not go through.");
            latest.current.onPaid(res.data);
          },
          onError: (err: unknown) => {
            latest.current.onError(err instanceof Error ? err.message : "PayPal reported a problem. You have not been charged.");
          },
        });
        buttons = instance;
        return instance.render(holder.current).then(() => !cancelled && setState("ready"));
      })
      .catch(() => !cancelled && setState("failed"));
    return () => {
      cancelled = true;
      buttons?.close().catch(() => {});
    };
  }, [props.clientId, props.currency]);

  if (!props.clientId) {
    return (
      <p className="card-alert p-3.5 text-sm">
        PayPal is not set up on this server yet: <code>PAYPAL_CLIENT_ID</code> is missing. The cart works, but
        nobody can pay until it is added.
      </p>
    );
  }
  return (
    <div>
      {state === "loading" && <p className="py-3 text-center text-moss">Loading PayPal…</p>}
      {state === "failed" && (
        <p className="card-alert p-3.5 text-sm">
          PayPal did not load. Check your signal and reload the page.
        </p>
      )}
      <div
        ref={holder}
        aria-disabled={props.disabled}
        className={props.disabled ? "pointer-events-none opacity-40" : undefined}
      />
    </div>
  );
}
