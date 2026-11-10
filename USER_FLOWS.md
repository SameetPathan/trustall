# Trustall: user flows

Everything a person can do in Trustall, screen by screen, in the order they do it.

Trustall has two kinds of user:

| User | Who they are | Where they work | Sign-in |
| --- | --- | --- | --- |
| **Customer** | Someone taking goods from an unattended stall | `/s/<stall-address>` on their phone | None. No app, no account |
| **Owner** | The person who runs the stall | `/owner` and the pages under it | Stall address and passcode |

Live demo: <https://trustall.onrender.com>. Demo stall address: `meadow-lane`. Everything runs in the PayPal sandbox, and every page shows a "Sandbox demo, no real money" banner.

## Contents

1. [Page map](#1-page-map)
2. [Home page](#2-home-page)
3. [Customer flow](#3-customer-flow)
4. [Owner flow: setting up a stall](#4-owner-flow-setting-up-a-stall)
5. [Owner flow: signing in](#5-owner-flow-signing-in)
6. [Owner flow: Ledger tab](#6-owner-flow-ledger-tab)
7. [Owner flow: Shelf tab and the honesty score](#7-owner-flow-shelf-tab-and-the-honesty-score)
8. [Owner flow: Assistant tab](#8-owner-flow-assistant-tab)
9. [What happens without anyone pressing a button](#9-what-happens-without-anyone-pressing-a-button)
10. [The life of a sale](#10-the-life-of-a-sale)
11. [Rules the app never breaks](#11-rules-the-app-never-breaks)
12. [Limits and what the app does not do](#12-limits-and-what-the-app-does-not-do)

---

## 1. Page map

| Address | Who uses it | What it is for |
| --- | --- | --- |
| `/` | Anyone | Home page: what Trustall is, with links to the demo stall, the owner view and stall setup |
| `/s/<stall-address>` | Customer | The stall: snap a photo, check the cart, pay or ask for an invoice |
| `/owner/setup` | New owner | Create a stall from a photo of the price board |
| `/owner/sign` | Owner | The printable QR sign for the stall |
| `/owner/login` | Owner | Sign in with stall address and passcode |
| `/owner` | Owner | Dashboard with three tabs: Ledger, Shelf, Assistant |
| `/api/health` | Anyone | Shows which services are configured (database, PayPal, webhook, AI), without revealing any key |

How the pages connect:

- Home → **Try the demo stall** → `/s/meadow-lane`
- Home → **Open the owner view** → `/owner` (sends you to `/owner/login` if you are not signed in)
- Home → **Set up your own stall** → `/owner/setup` → `/owner/sign` → `/owner`
- Owner dashboard header → **Customer page**, **QR sign**, **Sign out**
- QR sign → scanned by a customer's phone → `/s/<stall-address>`

---

## 2. Home page

Address: `/`

What a visitor sees and can do:

1. A headline, a one-paragraph explanation, and an animated phone that loops through the three customer steps: Scan, Snap, Pay.
2. **Try the demo stall**: opens the demo stall as a customer.
3. **Open the owner view**: opens the owner dashboard (sign-in first).
4. Three cards explaining the steps at the table.
5. Example cards for what the owner gets: honesty score, live ledger, assistant, setup.
6. **Set up your own stall**: starts stall setup.
7. A short "who does what" section: AI reads photos, code does the arithmetic, PayPal is the source of truth.

---

## 3. Customer flow

Address: `/s/<stall-address>`. Reached by scanning the stall's QR sign. No sign-in at any point.

### Step 1. Arrive at the stall page

The customer sees:

- The stall's name.
- One large button: **Snap what you're taking**.
- A link: **Pick from the price list instead**.
- On the demo stall only: three **sample baskets** (Basket 1, 2, 3) for people who have no stall in front of them.
- **Today's prices**: every product with its unit and price.

If the address does not match any stall, the page says "No stall at this address" and offers **Open the demo stall**.

### Step 2. Give the app a basket

The customer has four ways to start. All four end at the same cart screen.

| Way | What the customer does | What the app does |
| --- | --- | --- |
| **Photo** | Presses **Snap what you're taking**; the phone camera opens; takes one photo of everything | Shrinks the photo in the browser, sends it to the AI with the stall's product list, gets back products, quantities and a confidence for each line |
| **Sample basket** | Taps Basket 1, 2 or 3 (demo stall) | Same as a photo, using the sample picture |
| **Price list** | Presses **Pick from the price list instead** | Opens an empty cart with the product list ready to tap |
| **Typing** | On the cart screen, opens **Add a missed item** and types, for example, "2 dozen eggs and a honey" | AI turns the sentence into cart lines |

While a photo is being read, the customer sees their own photo with a scanning line and "Looking at your basket". This takes a few seconds.

### Step 3. Check the cart ("Is this what you took?")

The cart shows a small copy of the customer's photo and one card per product:

- Product name, unit, price each, and the line total.
- A **minus** and **plus** control. Minus at quantity 1 removes the line. The most of one product is 20.
- A red **Check this one** label on any line the AI was less than 75% sure about. The label goes away once the customer changes that line.

Other things the customer can do here:

1. **Add a missed item**: opens the list of products not yet in the cart. Tapping one adds it. The same panel has the "Or type what you took" box.
2. **Add a tip**: No tip, $1.00 or $2.00.
3. See the **Total**, which updates on every change.
4. **Retake the photo**: opens the camera again and replaces the cart.
5. **Start over**: clears everything and returns to step 1.

Messages the customer may see:

| Situation | What the app says and does |
| --- | --- |
| The photo shows something the stall does not sell | "Not on this stall's price list, so not added: …" under the cart |
| The AI finds none of the stall's products in the photo | "We could not spot this stall's items in that photo. Pick them from the list." and opens the product list |
| The photo is unreadable, or the AI is unavailable | "We could not read that photo. Pick your items from the list." and opens the product list. The customer can still pay |
| The file is not a picture | "The photo must be a JPEG, PNG or WebP image." |
| Typed text matches nothing | "We could not match that. Tap the items in the list instead." |

### Step 4a. Pay with PayPal

1. The customer presses the **PayPal** button.
2. The server prices the cart from its own price list, saves a draft sale, and creates a PayPal order for exactly that amount.
3. PayPal's own window opens. The customer signs in and approves.
4. The server captures the payment, checks that PayPal captured the same amount as the cart, and marks the sale **Paid**.
5. The customer sees the receipt.

If PayPal declines the payment method, PayPal's window reopens so the customer can choose another. If anything else fails, the customer sees the reason and has not been charged twice.

### Step 4b. Or: Invoice me

For a customer with no wallet or card to hand:

1. Presses **No wallet on you? Invoice me**.
2. Enters an email address.
3. Presses **Send invoice**.
4. The server prices the cart, and PayPal creates and emails an invoice for the items. Tips are not added to invoices.
5. The sale is saved as **Invoiced**. The customer sees "Invoice sent" with the amount and their email, and presses **Done**.
6. Later, when the customer pays the invoice from the PayPal email, the sale changes to **Paid** on its own.

### Step 5. Receipt

After a PayPal payment the customer sees a full green screen:

- "Paid. Thank you!" with an animated tick.
- The owner's thank-you message.
- A receipt: stall name, each item with quantity and price, the tip if any, and the total paid.
- **Buy something else**: returns to step 1.

### Everything a customer can do, in one list

- Open a stall from a QR code with nothing installed
- See the stall's products and prices
- Photograph a basket and get an itemised cart
- Use a sample basket (demo stall)
- Build a cart by tapping products
- Build or extend a cart by typing a sentence
- Raise, lower or remove any line
- See which lines the AI was unsure about
- Add a missed item
- Add a tip
- Pay with PayPal
- Ask for a PayPal invoice by email and pay later
- See an itemised receipt
- Retake the photo, or start over

---

## 4. Owner flow: setting up a stall

Address: `/owner/setup`. No sign-in needed; finishing setup signs the owner in.

### Step 1. Your stall

The owner enters:

- **Stall name**
- **PayPal email for the stall** (kept as the owner's contact)
- **An owner passcode**, at least 6 characters. This opens the ledger later.

### Step 2. Photos

1. **Price board** photo: the sign listing what is sold and what it costs. Or press **Use the sample price board**.
2. **The stall** photo (optional): helps when the board leaves something out.
3. Press **Draft my price list**. The AI reads the photos and drafts products with a name, a unit and a price.

Or press **Skip the photo and type the list** to enter products by hand.

### Step 3. Check the price list

Every drafted product appears as an editable row: product, sold per (unit), price.

- Edit any field. A row with a missing or invalid price is outlined in red.
- **Remove** a row.
- **Add a product** (up to 30).

These prices are what customers are charged, so the owner confirms them; the AI never has the last word. If the AI could not read a price it leaves it blank for the owner to fill in.

### Step 4. Save and get the sign

1. Press **Save stall and make my sign**. The stall is created with its own address, built from the stall name.
2. The owner lands on `/owner/sign`: a printable A5 sign with the stall name, a QR code, "Scan. Snap. Pay." and three one-line instructions.
3. On that page the owner can:
   - **Print the sign** (or save it as a PDF from the print window)
   - **Download the QR code only**
   - **Open my ledger**

---

## 5. Owner flow: signing in

Address: `/owner/login`

1. Enter the **Stall address** (the last part of the stall link, for example `meadow-lane`).
2. Enter the **Passcode**.
3. Press **Sign in**. The owner lands on the dashboard at `/owner` and stays signed in on that browser for 14 days.

A wrong address or passcode shows "That stall and passcode do not match." Opening `/owner` or `/owner/sign` without being signed in sends the owner here.

### The dashboard

Address: `/owner`

At the top: the stall name and three links.

| Link | Where it goes |
| --- | --- |
| **Customer page** | The stall as customers see it |
| **QR sign** | The printable sign |
| **Sign out** | Ends the session and returns to the home page |

Below that, three tabs: **Ledger**, **Shelf**, **Assistant**. The dashboard refreshes itself every 4 seconds, so new sales appear without reloading.

If a service is not configured (PayPal keys, webhook id, AI key), a notice at the top names exactly what is missing. If the connection drops, a notice says so and the last figures stay on screen.

---

## 6. Owner flow: Ledger tab

The record of every sale PayPal knows about.

### Today at a glance

Three tiles, for the owner's local day:

- **Paid today**: money received and number of sales
- **Invoices waiting**: value and number of invoices not yet paid
- **Refunded**: value and number of refunds

### Running low

If a shelf count exists (see the Shelf tab), products at or under their low-stock level are listed with roughly how many are left. The estimate is the last shelf count minus paid sales since.

### Today's summary

Press **Write today's summary**. The server adds up the day's figures and the AI turns them into one short paragraph. The AI is given the totals; it does not calculate them.

### All sales

A switch chooses between two views of the same sales.

**Grid view** (shown first), a full data grid:

| The owner can | How |
| --- | --- |
| Sort by any column | Click the column heading |
| Filter any column (dates, numbers, text) | Use the menu in the column heading |
| Search across everything | Type in the search box, for example "honey" or "refunded" |
| Clear all filters | **Clear filters** |
| Export sales to a spreadsheet file | **Download CSV** |
| Page through many sales | Page controls under the grid: 20, 50 or 100 per page |
| See totals for whatever is filtered | The pinned bottom row adds up units, tips and totals of the rows on show, leaving refunds out |

Grid columns: time, status, items, units, tip, total, paid through (PayPal checkout, Invoice me, or Assistant invoice), how the cart was built (photo accepted as read, photo corrected by the customer, picked by hand, or sent by the owner), and customer email.

Under the grid, a bar chart shows **paid revenue by product**.

**Cards view**: sales grouped by Today, Yesterday and earlier dates. Each card shows:

- Status: **Paid**, **Invoiced** or **Refunded**
- Time, and "sent by the assistant" if the assistant created it
- Each item with quantity and line total, marked "(customer corrected)" if the customer changed what the photo produced
- Tip, if any
- Customer email, for invoices
- **See the customer's photo**: opens the photo the customer took, visible to this stall's owner only. Sales with no photo say "picked from the list"

### Before the first sale

The tab shows "No sales yet", explains that a sale appears the moment PayPal confirms it, and offers **Open the customer page**.

---

## 7. Owner flow: Shelf tab and the honesty score

The honesty score answers a question no cash box can: of everything that left the shelf, how much was paid for?

```
gone = morning count - evening count        (per product, never below zero)
honesty rate = sum of min(paid, gone) / sum of gone
```

### Counting the shelf

1. Choose which count this is: **Morning** or **Evening**.
2. Give the app the count in one of three ways:
   - **Take the morning photo** (or evening): the camera opens; photograph the whole shelf. The AI counts the units of each product.
   - **Use the sample morning shelf** (or evening), on the demo stall.
   - **Enter counts by hand**.
3. A form appears with one number per product, filled in from the photo. The owner checks and corrects it.
4. Press **Save morning count** (or evening), or **Discard**.

Nothing is saved until the owner presses Save, so a miscount by the AI never reaches the score. After saving a morning count, the choice moves to Evening for next time.

### Reading the score

The card at the top of the tab changes with what has been counted:

| State | What the card shows |
| --- | --- |
| No counts yet | A prompt to add a morning photo |
| Morning count only | "Add an evening photo", with the time of the morning count |
| Morning and evening counts | The honesty score as a ring with a percentage, units that left the shelf, units paid for, the value of the gap, and the time window |
| Both counts, but nothing left the shelf | A note that there is no score for this window |

With both counts, a table lists every product: morning, evening, gone, paid and unpaid units, with unpaid units highlighted.

How the window works: the score runs from the most recent morning count to the first evening count after it, and "paid" means sales marked Paid inside that window. A product restocked during the day counts as nothing gone, so restocking cannot push the score above 100%.

Saved counts also drive the **Running low** notice on the Ledger tab.

---

## 8. Owner flow: Assistant tab

A chat that answers questions from the ledger and acts through PayPal, but only after the owner confirms.

### Asking

The owner types a request, or taps one of three examples:

- "How much did I make today, and what sold best?"
- "Refund the last honey sale."
- "Send Riverside Cafe an invoice for 5 dozen eggs."

### What the assistant can look up (no confirmation needed)

| It can read | From |
| --- | --- |
| Sales, totals, best sellers, and any single sale | Trustall's own ledger |
| Shelf counts, honesty score, low stock | Trustall's shelf records |
| Transactions, one order, one invoice, the invoice list, one refund | PayPal, through the PayPal Agent Toolkit (read-only tools) |

### What the assistant can propose (confirmation always needed)

| Action | What the owner asks | What the card says |
| --- | --- | --- |
| **Refund** a paid sale, in full | "Refund the last honey sale" | "Refund $X for <items>" |
| **Create and send an invoice** for catalog products | "Send Riverside Cafe an invoice for 5 dozen eggs" | "Invoice <name> <email> $X for <items>" |

The flow for either action:

1. The assistant finds the sale, or prices the invoice from the stall's price list, and shows a **card** with the exact action. The card says "Nothing has happened yet."
2. The owner presses **Confirm** or **Cancel**.
3. On Confirm, the server calls PayPal through the Agent Toolkit, then reads the result back from PayPal to verify it.
4. The card shows the outcome, for example "Refunded $8.00. PayPal refund … is COMPLETED", and PayPal's debug id.
5. The ledger updates: a refund turns the sale **Refunded**; an invoice appears as a new **Invoiced** sale.
6. The assistant is told the real outcome, so its next answers are based on what actually happened.

On Cancel, nothing is sent to PayPal.

Details worth knowing:

- Pressing Confirm twice cannot refund twice. Each proposal can be used once.
- The assistant only chooses products and quantities for an invoice. Prices come from the price list, and are checked again at the moment of Confirm.
- If the owner names a customer whose email is not saved and does not give one, the assistant asks for it instead of guessing. The demo stall has one saved customer, Riverside Cafe.
- Only Paid sales with a PayPal capture can be refunded. A sale paid by invoice cannot be refunded from here.

### Action log

Under the chat, every proposed action is listed with its status (Proposed, Done, Failed or Cancelled), the time, the result message and the PayPal debug id.

### Everything an owner can do, in one list

- Create a stall from a photo of a price board, or by typing the list
- Check and correct every drafted price before it goes live
- Print an A5 QR sign, or download the QR code
- Sign in and out
- Watch sales arrive live
- See today's paid, invoiced and refunded totals
- Get an AI-written summary of the day
- Sort, filter, search and export all sales
- See totals for any filtered set of sales
- See paid revenue by product as a chart
- Open the photo a customer took for a sale
- See which sales customers corrected
- Count the shelf from a photo, or by hand, morning and evening
- Correct the AI's counts before saving
- See the honesty score, the unpaid units per product and the value of the gap
- Get low-stock warnings
- Ask the assistant about takings, best sellers, stock and honesty
- Refund a sale through the assistant, after confirming
- Create and send a PayPal invoice through the assistant, after confirming
- Review a log of every action the assistant took, with PayPal debug ids

---

## 9. What happens without anyone pressing a button

| Event | What Trustall does |
| --- | --- |
| PayPal reports a completed payment (webhook `PAYMENT.CAPTURE.COMPLETED`) | Verifies the message with PayPal, then marks the matching sale Paid if it is not already |
| PayPal reports a refund (webhook `PAYMENT.CAPTURE.REFUNDED`) | Verifies it, then marks the sale Refunded |
| A customer pays an invoice (webhook `INVOICING.INVOICE.PAID`) | Verifies it, then moves the sale from Invoiced to Paid |
| PayPal sends the same message twice | The second copy is recognised by its id and ignored |
| A message arrives that PayPal did not sign | Rejected. Nothing changes |
| The owner dashboard is open | Refreshes every 4 seconds |
| The server starts | Applies database updates and makes sure the demo stall exists with the current price list |

---

## 10. The life of a sale

A sale is always in one of four states.

| State | Meaning | Shown in the ledger |
| --- | --- | --- |
| **Draft** | A cart that reached PayPal but has not been paid | No |
| **Invoiced** | A PayPal invoice was sent and is waiting | Yes |
| **Paid** | PayPal confirmed the money | Yes |
| **Refunded** | The payment was returned | Yes |

How a sale moves:

- Customer presses the PayPal button → **Draft**
- Customer approves in PayPal and the capture succeeds → **Paid**
- Customer chooses Invoice me, or the owner confirms an assistant invoice → **Invoiced**
- The invoice is paid → **Paid**
- The owner confirms a refund → **Refunded**

A sale never moves backwards. A late or repeated message from PayPal cannot turn a refunded sale back into a paid one.

---

## 11. Rules the app never breaks

1. **The AI never sets a price.** It names products and counts them. Every total is calculated on the server from the stall's price list, in whole cents.
2. **Nothing is charged without the customer's own action.** Payment happens only when the customer presses PayPal's button on a cart they can see and approves it in PayPal.
3. **A sale is Paid only on PayPal's word.** Either PayPal's capture response or a verified webhook.
4. **The assistant cannot move money or send mail by itself.** Refunds and invoices wait behind a Confirm button.
5. **The assistant gets a short list of PayPal tools.** Reading transactions, orders, invoices and refunds; creating a refund; creating and sending an invoice. Nothing else.
6. **The owner confirms what the AI reads.** Drafted prices and shelf counts are shown for checking before they are saved.
7. **A failed photo never blocks a sale.** The customer can always pick items by hand.
8. **Customer photos are private.** Only the signed-in owner of that stall can open them.

---

## 12. Limits and what the app does not do

Limits in place:

- At most 20 of one product per customer cart; at most 500 per line on an assistant invoice
- Tips: none, $1.00 or $2.00
- At most 30 products per stall at setup
- Shelf counts: 0 to 500 per product
- To protect a public demo, each visitor is limited per minute: 20 photo or text readings, 30 payment attempts, 6 invoices, 10 sign-in tries

Not in this version:

- Customer accounts or order history. The stall link is public by design
- Real money. Sandbox only
- Editing the price list after setup (create a new stall instead)
- Partial refunds, or refunding a sale that was paid by invoice
- Recurring invoices
- Paying each owner's own PayPal account. Every stall is paid into the demo's sandbox business account
- Currencies other than US dollars
