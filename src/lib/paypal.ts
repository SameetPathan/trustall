/**
 * PayPal sandbox REST client. Sandbox only, on purpose: the base URL is fixed.
 * There is no mock layer. If credentials are missing, calls fail with a clear message.
 */
import { requireEnv } from "./env";
import { centsToDecimal } from "./money";

export const PAYPAL_BASE = "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly debugId: string | null,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

interface TokenCache {
  token: string;
  expiresAt: number;
}
const globalForToken = globalThis as unknown as { __paypalToken?: TokenCache };

export async function getAccessToken(): Promise<string> {
  const cached = globalForToken.__paypalToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const id = requireEnv("PAYPAL_CLIENT_ID");
  const secret = requireEnv("PAYPAL_CLIENT_SECRET");
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const debugId = res.headers.get("paypal-debug-id");
  if (!res.ok) {
    const body = await res.text();
    throw new PayPalError(
      `PayPal rejected the sandbox credentials (HTTP ${res.status}). Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.`,
      res.status,
      debugId,
      body,
    );
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  globalForToken.__paypalToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

export interface PayPalResponse<T> {
  data: T;
  status: number;
  debugId: string | null;
}

export async function paypalFetch<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; rawBody?: string; requestId?: string } = {},
): Promise<PayPalResponse<T>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  // Idempotency key: a retried request with the same id does not create a second resource.
  if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId;

  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
    cache: "no-store",
  });
  const debugId = res.headers.get("paypal-debug-id");
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const d = data as { message?: string; name?: string; details?: { issue?: string; description?: string }[] } | null;
    const issue = d?.details?.[0];
    const reason = issue?.description ?? issue?.issue ?? d?.message ?? d?.name ?? `HTTP ${res.status}`;
    throw new PayPalError(`PayPal: ${reason}`, res.status, debugId, data);
  }
  return { data: data as T, status: res.status, debugId };
}

// ---------- Orders v2 ----------

export interface OrderLine {
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface PayPalOrder {
  id: string;
  status: string;
  purchase_units?: {
    custom_id?: string;
    payments?: {
      captures?: { id: string; status: string; custom_id?: string; amount: { currency_code: string; value: string } }[];
    };
  }[];
}

export function buildOrderBody(args: {
  saleId: string;
  stallName: string;
  currency: string;
  lines: OrderLine[];
  tipCents: number;
  totalCents: number;
}) {
  const items = args.lines.map((l) => ({
    name: l.name.slice(0, 127),
    quantity: String(l.quantity),
    unit_amount: { currency_code: args.currency, value: centsToDecimal(l.unitPriceCents) },
    category: "PHYSICAL_GOODS",
  }));
  if (args.tipCents > 0) {
    items.push({
      name: "Tip for the stall",
      quantity: "1",
      unit_amount: { currency_code: args.currency, value: centsToDecimal(args.tipCents) },
      category: "PHYSICAL_GOODS",
    });
  }
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: args.saleId,
        custom_id: args.saleId,
        description: `${args.stallName} (Trustall sandbox demo)`.slice(0, 127),
        amount: {
          currency_code: args.currency,
          value: centsToDecimal(args.totalCents),
          breakdown: {
            item_total: { currency_code: args.currency, value: centsToDecimal(args.totalCents) },
          },
        },
        items,
      },
    ],
    application_context: {
      brand_name: args.stallName.slice(0, 127),
      shipping_preference: "NO_SHIPPING",
      user_action: "PAY_NOW",
    },
  };
}

export function createOrder(args: Parameters<typeof buildOrderBody>[0]) {
  return paypalFetch<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    body: buildOrderBody(args),
    requestId: `order-${args.saleId}`,
  });
}

export function captureOrder(orderId: string, saleId: string) {
  return paypalFetch<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    body: {},
    requestId: `capture-${saleId}`,
  });
}

export function getOrder(orderId: string) {
  return paypalFetch<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

// ---------- Payments v2 (refunds) ----------

export interface PayPalRefund {
  id: string;
  status: string;
  amount?: { currency_code: string; value: string };
}

export function refundCapture(captureId: string, requestId: string, note?: string) {
  return paypalFetch<PayPalRefund>(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: "POST",
    body: note ? { note_to_payer: note.slice(0, 255) } : {},
    requestId,
  });
}

export function getRefund(refundId: string) {
  return paypalFetch<PayPalRefund>(`/v2/payments/refunds/${encodeURIComponent(refundId)}`);
}

// ---------- Invoicing v2 ----------

export function buildInvoiceBody(args: {
  reference: string;
  stallName: string;
  currency: string;
  recipientEmail: string;
  recipientName?: string;
  note?: string;
  lines: OrderLine[];
}) {
  return {
    detail: {
      currency_code: args.currency,
      reference: args.reference,
      note: (args.note ?? `Thanks for stopping at ${args.stallName}. Pay when you can.`).slice(0, 4000),
      payment_term: { term_type: "DUE_ON_RECEIPT" },
    },
    invoicer: { business_name: args.stallName.slice(0, 300) },
    primary_recipients: [
      {
        billing_info: {
          ...(args.recipientName ? { business_name: args.recipientName.slice(0, 300) } : {}),
          email_address: args.recipientEmail,
        },
      },
    ],
    items: args.lines.map((l) => ({
      name: l.name.slice(0, 200),
      quantity: String(l.quantity),
      unit_amount: { currency_code: args.currency, value: centsToDecimal(l.unitPriceCents) },
      unit_of_measure: "QUANTITY",
    })),
  };
}

/** PayPal invoice ids look like INV2-XXXX-XXXX-XXXX-XXXX. */
export function extractInvoiceId(value: unknown): string | null {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const match = /INV2(?:-[A-Z0-9]{4}){4}/.exec(text);
  return match ? match[0] : null;
}

export async function createAndSendInvoice(args: Parameters<typeof buildInvoiceBody>[0]) {
  const created = await paypalFetch<{ id?: string; href?: string }>("/v2/invoicing/invoices", {
    method: "POST",
    body: buildInvoiceBody(args),
    requestId: `invoice-${args.reference}`,
  });
  const invoiceId = (created.data as { id?: string })?.id ?? extractInvoiceId(created.data);
  if (!invoiceId) {
    throw new PayPalError("PayPal created the invoice but did not return its id.", created.status, created.debugId, created.data);
  }
  const sent = await paypalFetch(`/v2/invoicing/invoices/${invoiceId}/send`, {
    method: "POST",
    body: { send_to_invoicer: true, send_to_recipient: true },
    requestId: `invoice-send-${args.reference}`,
  });
  return { invoiceId, debugId: sent.debugId ?? created.debugId };
}

export function getInvoice(invoiceId: string) {
  return paypalFetch<{ id: string; status: string }>(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`);
}

// ---------- Webhooks ----------

/**
 * Posts the event back to PayPal for verification. The raw request body is
 * spliced into the verification payload as-is, because re-serialising the JSON
 * can change bytes and make PayPal answer FAILURE.
 *
 * Note: events from PayPal's webhook simulator can never pass this check.
 */
export async function verifyWebhookSignature(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = requireEnv("PAYPAL_WEBHOOK_ID");
  const fields = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
  };
  if (Object.values(fields).some((v) => !v)) return false;
  const head = JSON.stringify(fields);
  const payload = `${head.slice(0, -1)},"webhook_event":${rawBody}}`;
  const res = await paypalFetch<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    rawBody: payload,
  });
  return res.data?.verification_status === "SUCCESS";
}
