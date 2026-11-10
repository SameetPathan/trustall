/**
 * The owner's agent.
 *
 * PayPal access goes through the official PayPal Agent Toolkit with an explicit
 * allow-list. Reads run straight away. Writes (refund, invoice) are never run by
 * the model: the model can only *propose* them, the proposal is stored as an
 * AgentAction, and the toolkit's write tool runs only after the owner presses Confirm.
 */
import Anthropic from "@anthropic-ai/sdk";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { and, desc, eq } from "drizzle-orm";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { Stall, AgentAction } from "@/db/schema";
import { aiClient, aiModel } from "./ai";
import { priceCart, CartError, type CartLineInput } from "./cart";
import { requireEnv } from "./env";
import { newId } from "./ids";
import { centsToDecimal, formatMoney } from "./money";
import { extractInvoiceId, getInvoice, getRefund } from "./paypal";
import { createDraftSale, getCatalog, getContacts, getLedger, getSale, getShelfStatus } from "./store";
import { formatRate } from "./reconcile";

const { agentActions, sales } = schema;

// ---------- PayPal Agent Toolkit, allow-listed ----------

interface ToolkitTool {
  description: string;
  parameters: ZodTypeAny;
  execute: (args: unknown, options: { toolCallId: string; messages: unknown[] }) => Promise<unknown>;
}

/** Only these PayPal actions exist for the agent. Nothing else is ever constructed. */
export const TOOLKIT_ACTIONS = {
  transactions: { list: true },
  orders: { get: true },
  invoices: { create: true, send: true, get: true, list: true },
  payments: { createRefund: true, getRefunds: true },
} as const;

/** Toolkit tools the model may call directly: they only read. */
export const READ_TOOLS = ["list_transactions", "get_order", "get_invoice", "list_invoices", "get_refund"] as const;
/** Toolkit tools that move money or send mail. Only confirmAction() calls these. */
export const WRITE_TOOLS = ["create_refund", "create_invoice", "send_invoice"] as const;

const globalForToolkit = globalThis as unknown as { __paypalToolkit?: Record<string, ToolkitTool> };

function toolkitTools(): Record<string, ToolkitTool> {
  if (!globalForToolkit.__paypalToolkit) {
    const toolkit = new PayPalAgentToolkit({
      clientId: requireEnv("PAYPAL_CLIENT_ID"),
      clientSecret: requireEnv("PAYPAL_CLIENT_SECRET"),
      configuration: { actions: TOOLKIT_ACTIONS, context: { sandbox: true } },
    });
    const all = toolkit.getTools() as unknown as Record<string, ToolkitTool>;
    const allowed = new Set<string>([...READ_TOOLS, ...WRITE_TOOLS]);
    globalForToolkit.__paypalToolkit = Object.fromEntries(Object.entries(all).filter(([name]) => allowed.has(name)));
  }
  return globalForToolkit.__paypalToolkit;
}

async function runToolkit(name: string, args: unknown): Promise<{ ok: boolean; data: unknown; text: string }> {
  const tool = toolkitTools()[name];
  if (!tool) throw new Error(`PayPal tool ${name} is not on the allow-list.`);
  const out = await tool.execute(args, { toolCallId: newId("call"), messages: [] });
  const text = typeof out === "string" ? out : JSON.stringify(out);
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* plain text result */
  }
  const failed =
    (typeof data === "object" && data !== null && ("error" in data || (data as { ok?: boolean }).ok === false)) ||
    /^\s*(error|failed)/i.test(text);
  return { ok: !failed, data, text };
}

// ---------- tools the model sees ----------

const proposeRefundZod = z.object({
  saleId: z.string().min(1),
  reason: z.string().max(200).optional(),
});

const proposeInvoiceZod = z.object({
  recipientName: z.string().min(1).max(120),
  recipientEmail: z.string().email(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(500) })).min(1).max(20),
  note: z.string().max(300).optional(),
});

/** zod-to-json-schema writes optional-or-null fields as anyOf [{not:{}}, X]; flatten those to X. */
function simplifySchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(simplifySchema);
  if (!node || typeof node !== "object") return node;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.anyOf)) {
    const real = obj.anyOf.filter((o) => !(o && typeof o === "object" && "not" in (o as object)));
    if (real.length === 1 && real.length !== obj.anyOf.length) {
      const { anyOf: _dropped, ...rest } = obj;
      return simplifySchema({ ...(real[0] as object), ...rest });
    }
  }
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, simplifySchema(v)]));
}

export function modelTools(): Anthropic.Tool[] {
  const tk = toolkitTools();
  const paypalReads: Anthropic.Tool[] = READ_TOOLS.filter((n) => tk[n]).map((name) => {
    const { $schema: _ignored, ...inputSchema } = simplifySchema(
      zodToJsonSchema(tk[name].parameters, { $refStrategy: "none" }),
    ) as Record<string, unknown>;
    return {
      name,
      description: `[PayPal sandbox, read only] ${tk[name].description.trim()}`.slice(0, 1000),
      input_schema: inputSchema as Anthropic.Tool["input_schema"],
    };
  });
  return [
    {
      name: "get_ledger",
      description:
        "Read this stall's own ledger: sales with their items, status (PAID, INVOICED, REFUNDED), totals and times, newest first, plus pre-computed totals and best sellers. This is the source for 'how much did I make' and for finding a sale to refund. Prefer it over list_transactions for totals, because sandbox transaction reports lag.",
      input_schema: {
        type: "object",
        properties: {
          hours: { type: "integer", description: "How far back to look, in hours. Default 24. Maximum 720." },
        },
        additionalProperties: false,
      },
    },
    {
      name: "get_honesty",
      description: "Read the latest shelf counts, the honesty score (units paid for divided by units that left the shelf) and low-stock products.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "propose_refund",
      description:
        "Propose a full refund of one PAID sale from the ledger. This does NOT refund anything. It shows the owner a card with Confirm and Cancel; PayPal is called only after the owner presses Confirm.",
      input_schema: {
        type: "object",
        properties: {
          saleId: { type: "string", description: "The sale id from get_ledger, for example sale_ab12..." },
          reason: { type: "string", description: "Short note shown to the payer." },
        },
        required: ["saleId"],
        additionalProperties: false,
      },
    },
    {
      name: "propose_invoice",
      description:
        "Propose creating and sending a PayPal invoice for catalog products. This does NOT send anything. It shows the owner a card with Confirm and Cancel. Prices always come from the stall's catalog; you only choose products and quantities.",
      input_schema: {
        type: "object",
        properties: {
          recipientName: { type: "string" },
          recipientEmail: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { productId: { type: "string" }, quantity: { type: "integer" } },
              required: ["productId", "quantity"],
              additionalProperties: false,
            },
          },
          note: { type: "string" },
        },
        required: ["recipientName", "recipientEmail", "items"],
        additionalProperties: false,
      },
    },
    ...paypalReads,
  ];
}

export interface ProposedAction {
  id: string;
  tool: string;
  summary: string;
  status: AgentAction["status"];
}

async function ledgerForModel(stall: Stall, hours: number) {
  const since = new Date(Date.now() - Math.min(Math.max(hours, 1), 720) * 3600_000);
  const ledger = await getLedger(stall.id, { since, limit: 100 });
  const paid = ledger.filter((s) => s.status === "PAID");
  const units = new Map<string, { name: string; units: number; cents: number }>();
  for (const s of paid)
    for (const i of s.items) {
      const u = units.get(i.productId) ?? { name: i.name, units: 0, cents: 0 };
      u.units += i.quantity;
      u.cents += i.quantity * i.unitPriceCents;
      units.set(i.productId, u);
    }
  const money = (c: number) => formatMoney(c, stall.currency);
  return {
    windowHours: hours,
    now: new Date().toISOString(),
    totals: {
      paidSales: paid.length,
      paidTotal: money(paid.reduce((a, s) => a + s.totalCents, 0)),
      invoicedUnpaidSales: ledger.filter((s) => s.status === "INVOICED").length,
      invoicedUnpaidTotal: money(ledger.filter((s) => s.status === "INVOICED").reduce((a, s) => a + s.totalCents, 0)),
      refundedSales: ledger.filter((s) => s.status === "REFUNDED").length,
      refundedTotal: money(ledger.filter((s) => s.status === "REFUNDED").reduce((a, s) => a + s.totalCents, 0)),
    },
    bestSellers: [...units.values()]
      .sort((a, b) => b.units - a.units)
      .slice(0, 5)
      .map((u) => ({ product: u.name, unitsPaid: u.units, revenue: money(u.cents) })),
    sales: ledger.map((s) => ({
      saleId: s.id,
      status: s.status,
      total: money(s.totalCents),
      createdAt: s.createdAt,
      customerEmail: s.customerEmail,
      items: s.items.map((i) => `${i.quantity} x ${i.name}`),
    })),
  };
}

async function proposeRefund(stall: Stall, input: unknown): Promise<{ result: string; action?: ProposedAction }> {
  const parsed = proposeRefundZod.safeParse(input);
  if (!parsed.success) return { result: "Invalid arguments. saleId is required." };
  const sale = await getSale(parsed.data.saleId);
  if (!sale || sale.stallId !== stall.id) return { result: "No sale with that id in this stall's ledger. Call get_ledger and use a saleId from it." };
  if (sale.status !== "PAID") return { result: `That sale is ${sale.status}, so it can not be refunded. Only PAID sales can.` };
  if (!sale.paypalCaptureId) return { result: "That sale has no PayPal capture id (it was probably paid by invoice), so it can not be refunded from here." };

  const items = sale.items.map((i) => `${i.quantity} x ${i.name}`).join(", ");
  const summary = `Refund ${formatMoney(sale.totalCents, sale.currency)} for ${items}`;
  const id = newId("act");
  await getDb().insert(agentActions).values({
    id,
    stallId: stall.id,
    tool: "create_refund",
    argsJson: { saleId: sale.id, captureId: sale.paypalCaptureId, reason: parsed.data.reason ?? null },
    summary,
  });
  return {
    result: `Proposed (action ${id}): ${summary}. Nothing has been refunded yet. The owner now sees a card and must press Confirm.`,
    action: { id, tool: "create_refund", summary, status: "PROPOSED" },
  };
}

async function proposeInvoice(stall: Stall, input: unknown): Promise<{ result: string; action?: ProposedAction }> {
  const parsed = proposeInvoiceZod.safeParse(input);
  if (!parsed.success) return { result: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join("; ")}` };
  const catalog = await getCatalog(stall.id);
  let cart;
  try {
    cart = priceCart(parsed.data.items as CartLineInput[], catalog, { maxQuantity: 500 });
  } catch (err) {
    if (err instanceof CartError) return { result: `${err.message} Use product ids from the catalog in your instructions.` };
    throw err;
  }
  const items = cart.lines.map((l) => `${l.quantity} x ${l.name}`).join(", ");
  const summary = `Invoice ${parsed.data.recipientName} <${parsed.data.recipientEmail}> ${formatMoney(cart.totalCents, stall.currency)} for ${items}`;
  const id = newId("act");
  await getDb().insert(agentActions).values({
    id,
    stallId: stall.id,
    tool: "create_invoice+send_invoice",
    argsJson: {
      recipientName: parsed.data.recipientName,
      recipientEmail: parsed.data.recipientEmail,
      items: parsed.data.items,
      note: parsed.data.note ?? null,
    },
    summary,
  });
  return {
    result: `Proposed (action ${id}): ${summary}. Nothing has been sent yet. The owner now sees a card and must press Confirm.`,
    action: { id, tool: "create_invoice+send_invoice", summary, status: "PROPOSED" },
  };
}

// ---------- chat turn ----------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function runAgentTurn(stall: Stall, history: ChatMessage[]): Promise<{ reply: string; actions: ProposedAction[] }> {
  const [catalog, contacts] = await Promise.all([getCatalog(stall.id), getContacts(stall.id)]);
  const system = `You are the assistant for the owner of "${stall.name}", an unattended honesty stall that takes PayPal through Trustall. Everything runs in the PayPal sandbox; no real money moves.

Current time: ${new Date().toISOString()}. Stall currency: ${stall.currency}.

Catalog (product id: name, unit, price):
${catalog.map((p) => `- ${p.id}: ${p.name}, ${p.unit}, ${formatMoney(p.priceCents, p.currency)}`).join("\n")}

Known customers:
${contacts.length ? contacts.map((c) => `- ${c.name} <${c.email}>`).join("\n") : "- none saved"}

How to work:
- For takings, best sellers and finding a sale, call get_ledger. Quote its pre-computed totals; do not add up money yourself.
- To refund, find the sale in the ledger (for "the last honey sale", the newest PAID sale containing honey) and call propose_refund with its saleId.
- To invoice, call propose_invoice with catalog product ids and quantities. If the customer's email is not in the known customers list and the owner did not give one, ask for it instead of guessing.
- You can not refund or send anything yourself. propose_* only shows the owner a card. After proposing, tell the owner in one sentence what the card will do and ask them to press Confirm. Never say an action is done unless a message in the conversation says it was confirmed and completed.
- Never state or invent prices that are not in the catalog or the ledger.
- Keep answers short and plain: a sentence or two, no markdown tables or headings.`;

  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const tools = modelTools();
  const actions: ProposedAction[] = [];
  const client = aiClient();

  for (let step = 0; step < 6; step++) {
    const res = await client.messages.create({ model: aiModel(), max_tokens: 1500, system, tools, messages });
    if (res.stop_reason !== "tool_use") {
      const reply = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: reply || "Done.", actions };
    }
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      let result: string;
      let isError = false;
      try {
        if (block.name === "get_ledger") {
          const hours = Number((block.input as { hours?: number })?.hours ?? 24) || 24;
          result = JSON.stringify(await ledgerForModel(stall, hours));
        } else if (block.name === "get_honesty") {
          const s = await getShelfStatus(stall.id);
          result = JSON.stringify({
            openingCountAt: s.open?.takenAt ?? null,
            closingCountAt: s.close?.takenAt ?? null,
            honestyRate: s.honesty ? formatRate(s.honesty.rate) : "not available: needs an opening and a closing shelf photo",
            unitsGone: s.honesty?.unitsGone ?? null,
            unitsPaid: s.honesty?.unitsPaid ?? null,
            valueOfGap: s.honesty ? formatMoney(s.honesty.gapCents, stall.currency) : null,
            lowStock: s.lowStock.map((l) => `${l.name} (${l.unit}): about ${l.estimated} left`),
          });
        } else if (block.name === "propose_refund") {
          const out = await proposeRefund(stall, block.input);
          result = out.result;
          if (out.action) actions.push(out.action);
        } else if (block.name === "propose_invoice") {
          const out = await proposeInvoice(stall, block.input);
          result = out.result;
          if (out.action) actions.push(out.action);
        } else if ((READ_TOOLS as readonly string[]).includes(block.name)) {
          const out = await runToolkit(block.name, block.input);
          result = out.text.slice(0, 12_000);
          isError = !out.ok;
        } else {
          result = "That tool is not available.";
          isError = true;
        }
      } catch (err) {
        console.error("[agent] tool failed", block.name, err);
        result = `Tool failed: ${err instanceof Error ? err.message : "unknown error"}`;
        isError = true;
      }
      results.push({ type: "tool_result", tool_use_id: block.id, content: result, is_error: isError });
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "I could not finish that in a few steps. Try asking for one thing at a time.", actions };
}

// ---------- the confirm gate ----------

export interface ActionOutcome {
  status: AgentAction["status"];
  message: string;
  paypalDebugId: string | null;
}

async function finish(id: string, status: "DONE" | "FAILED", message: string, result: unknown, debugId: string | null): Promise<ActionOutcome> {
  await getDb()
    .update(agentActions)
    .set({ status, resultJson: { message, result } as Record<string, unknown>, paypalDebugId: debugId })
    .where(eq(agentActions.id, id));
  return { status, message, paypalDebugId: debugId };
}

function debugIdFrom(value: unknown): string | null {
  const match = /"?debug_id"?\s*[:=]\s*"?([a-f0-9]{8,})/i.exec(typeof value === "string" ? value : JSON.stringify(value ?? ""));
  return match ? match[1] : null;
}

export async function cancelAction(stall: Stall, actionId: string): Promise<ActionOutcome> {
  const rows = await getDb()
    .update(agentActions)
    .set({ status: "CANCELLED" })
    .where(and(eq(agentActions.id, actionId), eq(agentActions.stallId, stall.id), eq(agentActions.status, "PROPOSED")))
    .returning({ id: agentActions.id });
  return rows.length
    ? { status: "CANCELLED", message: "Cancelled. Nothing was sent to PayPal.", paypalDebugId: null }
    : { status: "FAILED", message: "That action was already handled.", paypalDebugId: null };
}

/**
 * Runs a proposed action. The PROPOSED -> CONFIRMED update is atomic, so a
 * double tap on Confirm can not refund twice.
 */
export async function confirmAction(stall: Stall, actionId: string): Promise<ActionOutcome> {
  const db = getDb();
  const claimed = await db
    .update(agentActions)
    .set({ status: "CONFIRMED" })
    .where(and(eq(agentActions.id, actionId), eq(agentActions.stallId, stall.id), eq(agentActions.status, "PROPOSED")))
    .returning();
  const action = claimed[0];
  if (!action) return { status: "FAILED", message: "That action was already handled.", paypalDebugId: null };

  try {
    if (action.tool === "create_refund") {
      const args = action.argsJson as { saleId: string; captureId: string; reason: string | null };
      const sale = await getSale(args.saleId);
      if (!sale || sale.status !== "PAID" || sale.paypalCaptureId !== args.captureId) {
        return finish(action.id, "FAILED", "That sale is no longer in a refundable state.", null, null);
      }
      const out = await runToolkit("create_refund", {
        capture_id: args.captureId,
        ...(args.reason ? { note_to_payer: args.reason } : {}),
      });
      const refundId = (out.data as { id?: string } | null)?.id ?? null;
      if (!out.ok || !refundId) {
        return finish(action.id, "FAILED", "PayPal did not accept the refund.", out.data, debugIdFrom(out.text));
      }
      // Read the refund back from PayPal: confirms it exists and gives us a debug id to log.
      const check = await getRefund(refundId);
      await db
        .update(sales)
        .set({ status: "REFUNDED", paypalRefundId: refundId })
        .where(and(eq(sales.id, sale.id), eq(sales.status, "PAID")));
      return finish(
        action.id,
        "DONE",
        `Refunded ${formatMoney(sale.totalCents, sale.currency)}. PayPal refund ${refundId} is ${check.data.status}.`,
        check.data,
        check.debugId,
      );
    }

    if (action.tool === "create_invoice+send_invoice") {
      const args = action.argsJson as {
        recipientName: string;
        recipientEmail: string;
        items: CartLineInput[];
        note: string | null;
      };
      const catalog = await getCatalog(stall.id);
      const cart = priceCart(args.items, catalog, { maxQuantity: 500 }); // priced again at confirm time, from the database
      const saleId = await createDraftSale({ stall, cart, source: "AGENT", customerEmail: args.recipientEmail });

      const created = await runToolkit("create_invoice", {
        currency_code: stall.currency,
        reference: saleId,
        note: args.note ?? `Invoice from ${stall.name}. Thank you!`,
        invoicer_business_name: stall.name,
        primary_recipients: [{ billing_info: { business_name: args.recipientName, email_address: args.recipientEmail } }],
        items: cart.lines.map((l) => ({
          name: l.name,
          quantity: String(l.quantity),
          unit_amount: { currency_code: stall.currency, value: centsToDecimal(l.unitPriceCents) },
          unit_of_measure: "QUANTITY",
        })),
      });
      const invoiceId = extractInvoiceId(created.text);
      if (!created.ok || !invoiceId) {
        return finish(action.id, "FAILED", "PayPal did not create the invoice.", created.data, debugIdFrom(created.text));
      }
      const sent = await runToolkit("send_invoice", { invoice_id: invoiceId, send_to_recipient: true });
      if (!sent.ok) {
        return finish(action.id, "FAILED", `Invoice ${invoiceId} was created as a draft but PayPal did not send it.`, sent.data, debugIdFrom(sent.text));
      }
      const check = await getInvoice(invoiceId);
      await db
        .update(sales)
        .set({ status: "INVOICED", paypalInvoiceId: invoiceId })
        .where(and(eq(sales.id, saleId), eq(sales.status, "DRAFT")));
      return finish(
        action.id,
        "DONE",
        `Invoice ${invoiceId} for ${formatMoney(cart.totalCents, stall.currency)} sent to ${args.recipientEmail}. PayPal status: ${check.data.status}.`,
        check.data,
        check.debugId,
      );
    }

    return finish(action.id, "FAILED", "Unknown action type.", null, null);
  } catch (err) {
    console.error("[agent] confirm failed", err);
    const debugId = (err as { debugId?: string | null })?.debugId ?? null;
    return finish(action.id, "FAILED", err instanceof Error ? err.message : "The action failed.", null, debugId);
  }
}

export async function recentActions(stallId: string, limit = 20) {
  return getDb().query.agentActions.findMany({
    where: eq(agentActions.stallId, stallId),
    orderBy: [desc(agentActions.createdAt)],
    limit,
  });
}
