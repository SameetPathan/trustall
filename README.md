# Trustall

**The honesty box that takes PayPal: scan, snap what you took, pay.**

A customer at an unattended farm stand scans a QR code, photographs what they are taking, and an AI turns the photo into an itemised PayPal checkout. The owner gets a ledger, a daily honesty score and a chat assistant that acts through PayPal, only after a confirm.

Built for the PayPal AI Hackathon. **Sandbox only: no real money moves.**

- Live demo: <https://trustall.onrender.com>
- Demo stall: `/s/meadow-lane`
- Owner view: `/owner` (stall address `meadow-lane`, passcode below)

## Judge quickstart

1. Open the live demo and press **Try the demo stall**.
2. Press one of the three **sample baskets** (or take a real photo on a phone).
3. Check the cart, press the PayPal button, and sign in with the sandbox buyer:

   | | |
   | --- | --- |
   | Sandbox buyer email | `trustall@personal.com` |
   | Sandbox buyer password | `Trust@1234` |
   | Owner passcode (stall `meadow-lane`) | `meadowlane` |

4. Open **Owner view**, sign in, and watch the sale appear in the ledger.
5. In the **Assistant** tab, type "Refund the last honey sale", press **Confirm**, and watch the ledger flip to Refunded.
6. In the **Shelf** tab, use the sample morning and evening shelves to get an honesty score.

> The sample baskets, shelves and price board are in `public/samples`. To use your own, replace those files (see `src/lib/samples.ts`).

## What it does

**Customer** (`/s/[slug]`, no app, no login)

- Snap-to-cart: one photo becomes an itemised cart, matched against the stall's own price list.
- Editable cart: plus and minus on every line, add a missed item from the list or by typing ("2 dozen eggs and a honey"). Lines the model was unsure about say "Check this one".
- PayPal checkout (Orders v2 + JS SDK buttons), optional tip, full-screen receipt.
- Invoice me: no wallet? Enter an email and PayPal sends an invoice (Invoicing v2).

**Owner** (`/owner`)

- Setup from a photo of the price board, then a printable A5 QR sign (`/owner/setup`, `/owner/sign`).
- Ledger: every sale item by item, Paid / Invoiced / Refunded, updated every few seconds, with an AI-written daily summary. The sales table is an **AG Grid** (sort, filter, search, a totals row that follows the filter, CSV export) with an **AG Charts** revenue-by-product chart.
- Shelf: morning and evening shelf photos give an honesty score and low-stock alerts.
- Assistant: asks the ledger questions, proposes refunds and invoices through the PayPal Agent Toolkit. Every PayPal write waits behind a Confirm button and is logged with a PayPal debug id.

## The rules the code keeps

| Rule | Where |
| --- | --- |
| The model never sets a price. Prices come from the database by product id. | `src/lib/cart.ts` (`priceCart`), used by every route that charges |
| Nothing is charged without the customer pressing PayPal's button on a cart they can see. | `src/components/PayPalButton.tsx` |
| A sale is marked paid only on PayPal's word: the capture response or a verified webhook. | `src/app/api/paypal/orders/[id]/capture`, `src/lib/webhook.ts` |
| Webhooks are verified with PayPal's signature endpoint and processed once per event id. | `src/lib/paypal.ts` (`verifyWebhookSignature`), `src/lib/webhook.ts` |
| The assistant can not refund or invoice without the owner pressing Confirm. | `src/lib/agent.ts` (`propose_*` tools vs `confirmAction`) |
| The assistant only gets allow-listed PayPal tools. | `TOOLKIT_ACTIONS`, `READ_TOOLS`, `WRITE_TOOLS` in `src/lib/agent.ts` |
| Every model answer is parsed with zod; one retry, then the manual picker. | `src/lib/ai.ts` |
| No mock PayPal layer. Missing credentials fail with a message that names the variable. | `src/lib/env.ts`, `src/lib/http.ts` |

Honesty score, per product between an opening and a closing count:

```
gone = open - close            honesty rate = sum(min(paid, gone)) / sum(gone)
```

## How AI is used

| Task | Model input | Output |
| --- | --- | --- |
| Cart from a photo | photo + catalog (ids, names, units) | JSON lines `{productId, quantity, confidence}` constrained to the catalog's ids |
| Cart from typed text | text + catalog | the same JSON |
| Catalog from a price board | one or two photos | draft products the owner confirms |
| Shelf counts | photo + catalog | units per product the owner confirms |
| Daily summary | totals computed by the server | one paragraph |
| Assistant | chat + tools | tool calls; writes are proposals only |

The model is Anthropic Claude through `@anthropic-ai/sdk`, with structured outputs (`output_config.format`). The model id is the `AI_MODEL` variable; everything goes through `src/lib/ai.ts`.

## Run it locally

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env          # then fill in the values (table below)

# Postgres: use your own, or this throwaway local one (no Docker needed)
npm run db:local              # leave running in a second terminal

npm run db:setup              # migrations + the demo stall "Meadow Lane Eggs & Honey"
npm run sandbox:proof         # optional: proves the PayPal keys work (token, $1 order, invoice)
npm run dev                   # http://localhost:3000
```

Without PayPal or AI keys the app still runs: the customer can build a cart by hand, and each missing piece says exactly which variable to set. `/api/health` shows what is configured.

### Environment variables

| Name | Purpose |
| --- | --- |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Sandbox REST app credentials |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Same client id, for the JS SDK (optional: falls back to `PAYPAL_CLIENT_ID`; the secret never reaches the browser) |
| `PAYPAL_WEBHOOK_ID` | Id of the webhook registered for `<APP_URL>/api/paypal/webhook` |
| `AI_API_KEY`, `AI_MODEL` | Anthropic API key and model id (default `claude-sonnet-5-5`) |
| `DATABASE_URL` | Postgres connection string |
| `APP_URL` | Public base URL, used in the QR code |
| `OWNER_DEMO_PASSCODE` | Passcode for the demo stall's owner view |
| `SESSION_SECRET` | Signs the owner session cookie |
| `DEMO_CAFE_EMAIL` (optional) | Email for the seeded customer "Riverside Cafe"; set it to a sandbox personal account so the assistant's invoice lands somewhere you can open |

### PayPal sandbox setup

1. In the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/), create a sandbox REST app. Copy its client id and secret.
2. Under Testing Tools > Sandbox Accounts, note one **personal** (buyer) account's email and password for the table above.
3. After deploying, add a webhook on the app for `https://YOUR-HOST/api/paypal/webhook` with these events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`, `INVOICING.INVOICE.PAID`. Copy the webhook id into `PAYPAL_WEBHOOK_ID`.

Events from PayPal's webhook **simulator** can not pass signature verification, so they are rejected here by design. Test with real sandbox payments. For local webhook testing, expose port 3000 with a tunnel and register that URL.

## Deploy on Render

`render.yaml` describes the web service and the Postgres database.

1. Push this folder to a public GitHub repo.
2. In Render: New > Blueprint, pick the repo. Fill in the variables it asks for (`APP_URL` is the service's own `https://...onrender.com` URL).
3. After the first deploy, register the webhook (step 3 above), paste `PAYPAL_WEBHOOK_ID` into Render, and redeploy.

The start command runs migrations and the (idempotent) seed on every boot.

## Tests

```bash
npm test          # money arithmetic, cart pricing, honesty score, webhook idempotency, vision contract
npm run typecheck
```

## Project layout

```text
drizzle/                     SQL migrations
src/db/                      schema, migrate, seed (demo stall with 8 products)
src/lib/paypal.ts            token cache, Orders, Invoicing, refunds, webhook verify
src/lib/ai.ts                model wrapper, prompts, zod schemas
src/lib/agent.ts             PayPal Agent Toolkit setup, allow-list, confirm gate
src/lib/cart.ts, money.ts    server-side pricing in integer cents
src/lib/reconcile.ts         honesty score
src/lib/webhook.ts           idempotent event handling
src/app/s/[slug]/            customer flow
src/app/owner/               ledger, shelf, assistant, setup, sign
src/app/api/                 vision, paypal, agent, owner routes
scripts/sandbox-proof.ts     milestone 0 check
public/samples/              sample baskets, shelves and price board
tests/
```

## Notes on what was built

- **Database layer is Drizzle ORM, not Prisma.** The schema is `src/db/schema.ts` and migrations are plain SQL in `drizzle/`.
- **Not built:** standing (recurring) invoices, reference photo crops per product, editing the catalog after setup.
- **One PayPal account.** Every stall is paid into the sandbox business account behind the REST app. Paying each stall owner's own account would need PayPal's multiparty (partner) onboarding.
- Refunds are full refunds. A sale paid by invoice can not be refunded from the assistant.

## Licence

MIT, see `LICENSE`.
