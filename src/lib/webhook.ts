/**
 * Webhook event handling, kept free of HTTP and database details so that the
 * idempotency rules can be tested on their own.
 */

export interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource?: Record<string, unknown>;
}

export interface WebhookStore {
  /** Records the event id. Returns false when this id was already recorded. */
  recordEvent(id: string, type: string): Promise<boolean>;
  /** Removes a recorded id, so a failed event can be retried by PayPal. */
  forgetEvent(id: string): Promise<void>;
  /** DRAFT or INVOICED -> PAID. Returns true when a row changed. */
  markPaidBySaleId(saleId: string, captureId: string, orderId: string | null): Promise<boolean>;
  /** PAID -> REFUNDED. */
  markRefundedByCaptureId(captureId: string, refundId: string): Promise<boolean>;
  /** INVOICED -> PAID. */
  markPaidByInvoiceId(invoiceId: string): Promise<boolean>;
}

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

export const HANDLED_EVENTS = [
  "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT.CAPTURE.REFUNDED",
  "INVOICING.INVOICE.PAID",
] as const;

function linkId(resource: Record<string, unknown>, rel: string, segment: string): string | null {
  const links = resource.links as { rel?: string; href?: string }[] | undefined;
  const href = links?.find((l) => l.rel === rel)?.href;
  if (!href) return null;
  const match = new RegExp(`/${segment}/([A-Za-z0-9-]+)`).exec(href);
  return match ? match[1] : null;
}

/** Call only after the signature has been verified. */
export async function handleWebhookEvent(event: PayPalWebhookEvent, store: WebhookStore): Promise<WebhookOutcome> {
  if (!event?.id || !event.event_type) return "ignored";

  const fresh = await store.recordEvent(event.id, event.event_type);
  if (!fresh) return "duplicate";

  try {
    const resource = event.resource ?? {};
    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        const saleId = typeof resource.custom_id === "string" ? resource.custom_id : null;
        const captureId = typeof resource.id === "string" ? resource.id : null;
        if (!saleId || !captureId) return "ignored"; // e.g. an invoice payment; handled by INVOICING.INVOICE.PAID
        const related = (resource.supplementary_data as { related_ids?: { order_id?: string } } | undefined)?.related_ids;
        await store.markPaidBySaleId(saleId, captureId, related?.order_id ?? null);
        return "processed";
      }
      case "PAYMENT.CAPTURE.REFUNDED": {
        const refundId = typeof resource.id === "string" ? resource.id : null;
        const captureId = linkId(resource, "up", "captures");
        if (!refundId || !captureId) return "ignored";
        await store.markRefundedByCaptureId(captureId, refundId);
        return "processed";
      }
      case "INVOICING.INVOICE.PAID": {
        const invoice = (resource.invoice as { id?: string } | undefined) ?? (resource as { id?: string });
        if (!invoice?.id) return "ignored";
        await store.markPaidByInvoiceId(invoice.id);
        return "processed";
      }
      default:
        return "ignored";
    }
  } catch (err) {
    // Let PayPal retry: forget the id so the retry is not treated as a duplicate.
    await store.forgetEvent(event.id);
    throw err;
  }
}
