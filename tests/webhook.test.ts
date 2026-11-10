import { describe, expect, it } from "vitest";
import { handleWebhookEvent, type WebhookStore } from "@/lib/webhook";

/** In-memory stand-in for the database, with the same state rules as the real store. */
function memoryStore(initial: Record<string, { status: string; captureId?: string; invoiceId?: string; refundId?: string }>) {
  const sales = structuredClone(initial);
  const events = new Set<string>();
  const calls = { paid: 0, refunded: 0, invoicePaid: 0 };
  const store: WebhookStore = {
    async recordEvent(id) {
      if (events.has(id)) return false;
      events.add(id);
      return true;
    },
    async forgetEvent(id) {
      events.delete(id);
    },
    async markPaidBySaleId(saleId, captureId) {
      calls.paid++;
      const s = sales[saleId];
      if (!s || (s.status !== "DRAFT" && s.status !== "INVOICED")) return false;
      s.status = "PAID";
      s.captureId = captureId;
      return true;
    },
    async markRefundedByCaptureId(captureId, refundId) {
      calls.refunded++;
      const s = Object.values(sales).find((x) => x.captureId === captureId && x.status === "PAID");
      if (!s) return false;
      s.status = "REFUNDED";
      s.refundId = refundId;
      return true;
    },
    async markPaidByInvoiceId(invoiceId) {
      calls.invoicePaid++;
      const s = Object.values(sales).find((x) => x.invoiceId === invoiceId && x.status === "INVOICED");
      if (!s) return false;
      s.status = "PAID";
      return true;
    },
  };
  return { store, sales, events, calls };
}

const captureCompleted = (eventId: string, saleId: string, captureId = "3Y662965014333303") => ({
  id: eventId,
  event_type: "PAYMENT.CAPTURE.COMPLETED",
  resource: {
    id: captureId,
    status: "COMPLETED",
    custom_id: saleId,
    amount: { value: "12.00", currency_code: "USD" },
    supplementary_data: { related_ids: { order_id: "9P99943869582473S" } },
  },
});

const captureRefunded = (eventId: string, captureId = "3Y662965014333303") => ({
  id: eventId,
  event_type: "PAYMENT.CAPTURE.REFUNDED",
  resource: {
    id: "1JU08902781691411",
    status: "COMPLETED",
    links: [
      { rel: "self", href: "https://api.sandbox.paypal.com/v2/payments/refunds/1JU08902781691411" },
      { rel: "up", href: `https://api.sandbox.paypal.com/v2/payments/captures/${captureId}` },
    ],
  },
});

describe("webhook handler", () => {
  it("marks a draft sale paid on PAYMENT.CAPTURE.COMPLETED", async () => {
    const m = memoryStore({ sale_1: { status: "DRAFT" } });
    expect(await handleWebhookEvent(captureCompleted("WH-1", "sale_1"), m.store)).toBe("processed");
    expect(m.sales.sale_1).toMatchObject({ status: "PAID", captureId: "3Y662965014333303" });
  });

  it("processes the same event id only once, however often PayPal resends it", async () => {
    const m = memoryStore({ sale_1: { status: "DRAFT" } });
    const event = captureCompleted("WH-1", "sale_1");
    expect(await handleWebhookEvent(event, m.store)).toBe("processed");
    expect(await handleWebhookEvent(event, m.store)).toBe("duplicate");
    expect(await handleWebhookEvent(event, m.store)).toBe("duplicate");
    expect(m.calls.paid).toBe(1);
  });

  it("handles concurrent deliveries of one event as a single change", async () => {
    const m = memoryStore({ sale_1: { status: "DRAFT" } });
    const event = captureCompleted("WH-1", "sale_1");
    const outcomes = await Promise.all([1, 2, 3, 4].map(() => handleWebhookEvent(event, m.store)));
    expect(outcomes.filter((o) => o === "processed")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "duplicate")).toHaveLength(3);
    expect(m.calls.paid).toBe(1);
  });

  it("does not move a sale backwards when a different event repeats the news", async () => {
    const m = memoryStore({ sale_1: { status: "DRAFT" } });
    await handleWebhookEvent(captureCompleted("WH-1", "sale_1"), m.store);
    await handleWebhookEvent(captureRefunded("WH-2"), m.store);
    expect(m.sales.sale_1.status).toBe("REFUNDED");
    // A late, distinct "completed" event must not turn a refunded sale back into a paid one.
    expect(await handleWebhookEvent(captureCompleted("WH-3", "sale_1"), m.store)).toBe("processed");
    expect(m.sales.sale_1.status).toBe("REFUNDED");
  });

  it("marks an invoiced sale paid on INVOICING.INVOICE.PAID, once", async () => {
    const m = memoryStore({ sale_2: { status: "INVOICED", invoiceId: "INV2-AAAA-BBBB-CCCC-DDDD" } });
    const event = { id: "WH-9", event_type: "INVOICING.INVOICE.PAID", resource: { invoice: { id: "INV2-AAAA-BBBB-CCCC-DDDD" } } };
    expect(await handleWebhookEvent(event, m.store)).toBe("processed");
    expect(await handleWebhookEvent(event, m.store)).toBe("duplicate");
    expect(m.sales.sale_2.status).toBe("PAID");
    expect(m.calls.invoicePaid).toBe(1);
  });

  it("ignores events it does not handle, and captures with no sale id", async () => {
    const m = memoryStore({});
    expect(await handleWebhookEvent({ id: "WH-5", event_type: "CHECKOUT.ORDER.APPROVED", resource: {} }, m.store)).toBe("ignored");
    expect(await handleWebhookEvent({ id: "WH-6", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "X" } }, m.store)).toBe("ignored");
    expect(await handleWebhookEvent({ id: "", event_type: "" }, m.store)).toBe("ignored");
  });

  it("forgets the event id when processing fails, so PayPal's retry is not dropped as a duplicate", async () => {
    const m = memoryStore({ sale_1: { status: "DRAFT" } });
    let failOnce = true;
    const flaky: WebhookStore = {
      ...m.store,
      async markPaidBySaleId(...args) {
        if (failOnce) {
          failOnce = false;
          throw new Error("database is down");
        }
        return m.store.markPaidBySaleId(...args);
      },
    };
    const event = captureCompleted("WH-1", "sale_1");
    await expect(handleWebhookEvent(event, flaky)).rejects.toThrow("database is down");
    expect(m.events.has("WH-1")).toBe(false);
    expect(await handleWebhookEvent(event, flaky)).toBe("processed");
    expect(m.sales.sale_1.status).toBe("PAID");
  });
});
