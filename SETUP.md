# Trustall: setup and pending steps

Follow this file from top to bottom. Parts 1 to 4 get the app running on your computer. Parts 5 to 8 are what is still pending before you can submit.

Commands are for Windows PowerShell, run inside `E:\Hackathon\trustall` unless a step says otherwise.

Deadline: Nov 13, 2026, 1:30 am IST (Nov 12, 12:00 pm Pacific). Aim to submit at least 3 hours earlier.

## Status

| Area | State |
| --- | --- |
| App code (customer flow, owner view, assistant, setup, QR sign) | Written |
| Build, type check, 24 automated tests | Passed |
| Pages, sign-in, stall setup, honesty score, error messages | Tested against a real database, with no keys set |
| PayPal checkout, invoice, refund, webhooks | **Not tested yet.** Needs your sandbox keys (Part 2 and Part 4) |
| Photo recognition and the assistant | **Not tested yet.** Needs your AI key (Part 2 and Part 4) |
| Page layout on a phone | **Not looked at yet.** Check it in Part 4 |
| Sample pictures | Done: six JPGs in `public\samples`, wired in and tested. See the note at the top of Part 5 |
| GitHub repo, Render deploy, webhook, video, Devpost | Pending (Parts 6 to 8) |

---

## Part 1. Install the tools (10 minutes)

- [ ] **1.1** Install Node.js 22 LTS from https://nodejs.org (version 20 or newer works).
- [ ] **1.2** Install Git from https://git-scm.com if you do not have it.
- [ ] **1.3** Open PowerShell and check both:

  ```powershell
  node -v
  git --version
  ```

- [ ] **1.4** Go to the project and install its packages:

  ```powershell
  cd E:\Hackathon\trustall
  npm install
  ```

  This takes a few minutes. Warnings are fine; an error is not.

## Part 2. Get your keys (30 minutes)

You need three things from two websites.

### PayPal sandbox

- [ ] **2.1** Sign in at https://developer.paypal.com/dashboard/ (create a developer account if needed).
- [ ] **2.2** Make sure the toggle at the top says **Sandbox**, not Live.
- [ ] **2.3** Go to **Apps & Credentials** > **Create App**. Name it `Trustall`, type Merchant. Copy the **Client ID** and the **Secret**.
- [ ] **2.4** Go to **Testing Tools** > **Sandbox Accounts**. You need one **Business** account (the app is linked to it) and one **Personal** account (the buyer). PayPal usually creates both for you.
- [ ] **2.5** Open the **Personal** account (the `...` menu > View/Edit) and write down its **email** and **password**. You pay with this account when testing, and judges will too.

### AI key

- [ ] **2.6** Sign in at https://console.anthropic.com, add billing credit, and create an API key under **API Keys**. Copy it.

### Put the keys in `.env`

- [ ] **2.7** Create your `.env` file:

  ```powershell
  Copy-Item .env.example .env
  notepad .env
  ```

- [ ] **2.8** Fill in these lines and save:

  ```
  PAYPAL_CLIENT_ID=            <- Client ID from 2.3
  PAYPAL_CLIENT_SECRET=        <- Secret from 2.3
  NEXT_PUBLIC_PAYPAL_CLIENT_ID=  <- the same Client ID again
  PAYPAL_WEBHOOK_ID=           <- leave empty for now (Part 7)
  AI_API_KEY=                  <- key from 2.6
  AI_MODEL=claude-sonnet-5-5
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/trustall
  APP_URL=http://localhost:3000
  OWNER_DEMO_PASSCODE=meadowlane
  SESSION_SECRET=              <- type any long random text
  ```

- [ ] **2.9** Optional but useful: add one more line so the assistant's test invoice goes to an inbox you can open. Use the sandbox Personal email from 2.5:

  ```
  DEMO_CAFE_EMAIL=your-sandbox-personal-email
  ```

  This must be in `.env` **before** step 3.2, because it is only read when the demo stall is first created.

Never commit `.env` or share it. It is already in `.gitignore`.

## Part 3. Start the app (5 minutes)

You need **two PowerShell windows**, both in `E:\Hackathon\trustall`.

- [ ] **3.1** **Window 1**: start the local database and leave it running.

  ```powershell
  npm run db:local
  ```

  Wait for `Postgres is running`. Do not close this window.

  If it fails on Windows, install PostgreSQL from https://www.postgresql.org/download/windows/ instead, create a database called `trustall`, and put its connection string in `DATABASE_URL`.

- [ ] **3.2** **Window 2**: create the tables and the demo stall.

  ```powershell
  npm run db:setup
  ```

  Expected: `Migrations applied.` then `Seeded demo stall "meadow-lane" with 8 products.`

- [ ] **3.3** **Window 2**: prove the PayPal keys work.

  ```powershell
  npm run sandbox:proof
  ```

  Expected: three lines, `1. Token: OK`, `2. Order: ... created`, `3. Invoice: ... sent`.
  If it prints `FAILED`, the message says why. The usual cause is a wrong Client ID or Secret, or Live keys instead of Sandbox keys.

- [ ] **3.4** **Window 2**: start the app.

  ```powershell
  npm run dev
  ```

  Open http://localhost:3000

- [ ] **3.5** Open http://localhost:3000/api/health. All four values under `configured` should be `true` except `webhook`, which stays `false` until Part 7.

## Part 4. Test everything (30 minutes)

This is the first time the PayPal and AI parts run for real, so go slowly and note anything that breaks. If a step fails, copy the error text on screen and the last lines in Window 2, and send them to me.

### Customer flow

- [ ] **4.1** Open http://localhost:3000 and press **Try the demo stall**.
- [ ] **4.2** Press **Basket 1**. After a few seconds you should see a cart with 2 x Eggs (dozen) and 1 x Wildflower honey.
- [ ] **4.3** Try Basket 2 (jam, sourdough, tomatoes) and Basket 3 (half dozen eggs, 3 zucchini, sunflowers). Note any wrong items or counts.
- [ ] **4.4** Change a quantity with plus and minus. Press **Add a missed item** and add one from the list. Type `2 dozen eggs and a honey` in the text box and press **Add**.
- [ ] **4.5** Press the gold **PayPal** button. In the popup, sign in with the sandbox **Personal** email and password from 2.5 and approve. You should land on a green **Paid. Thank you!** receipt.
- [ ] **4.6** Start over, build a cart, press **No wallet on you? Invoice me**, enter the sandbox Personal email, and send. You should see **Invoice sent**.

### Owner view

- [ ] **4.7** Open http://localhost:3000/owner. Stall address `meadow-lane`, passcode `meadowlane`.
- [ ] **4.8** **Ledger** tab: the sale from 4.5 shows as **Paid** and the one from 4.6 as **Invoiced**, with the right items. Press **Write today's summary**.
- [ ] **4.9** **Assistant** tab: press **How much did I make today, and what sold best?** and check the numbers against the ledger.
- [ ] **4.10** Type `Refund the last honey sale.` A card appears. Press **Confirm**. It should say Refunded with a PayPal debug id, and the ledger should show the sale as **Refunded**.
- [ ] **4.11** Type `Send Riverside Cafe an invoice for 5 dozen eggs.` Press **Confirm** on the card. A new **Invoiced** sale for $25.00 appears in the ledger.
- [ ] **4.12** **Shelf** tab: choose **Morning**, press **Use the sample morning shelf**, check the counts, save. Then **Evening**, **Use the sample evening shelf**, save. An honesty score appears.

### Setup flow

- [ ] **4.13** Open http://localhost:3000/owner/setup. Fill in a stall name, email and passcode. Press **No board to hand? Use the sample price board**, then **Draft my price list**. Check the eight products and prices, then save. You land on the QR sign page.

### On a phone

- [ ] **4.14** Find your computer's network address: run `ipconfig` and read the **IPv4 Address** (for example `192.168.1.20`).
- [ ] **4.15** With the phone on the same Wi-Fi, open `http://THAT-ADDRESS:3000/s/meadow-lane`. Check that nothing overflows the screen and buttons are easy to tap. Take a real photo with **Snap what you're taking**.

  Note: some phone browsers only allow the camera on `https`. If the camera does not open here, test it after deploying (Part 7).

- [ ] **4.16** Upload a blurry or unrelated photo. The app should offer the item list, not crash.

### Automated tests

- [ ] **4.17** Stop the app with `Ctrl+C` if you like, then:

  ```powershell
  npm test
  npm run typecheck
  ```

  Expected: 24 tests passed, and no output from typecheck.

---

## Part 5. Sample photos (done, with two things to tidy)

The six JPGs are in place and the app uses them. All three baskets give the right cart, and the demo stall's prices now match the price board. One thing is still open: `shelf-morning.jpg` and `shelf-evening.jpg` show two different stalls, and the evening one has price signs that do not match. Replace them with a matching pair (same shelf, no price signs) using the same file names. The steps below are only needed if you replace the pictures again.

The pictures in `public\samples` are drawings with labels, used as stand-ins. Replace them with real photos on a real table.

- [ ] **5.1** Set up a table with real produce that matches the demo price list: eggs (dozen and half dozen), honey, strawberry jam, sourdough, tomatoes, zucchini, sunflowers. If your produce differs, see 5.4.
- [ ] **5.2** Take six photos: three baskets, a full shelf (morning), a partly empty shelf (evening), and the price board.
- [ ] **5.3** Save them as JPG files in `public\samples`, then open `src\lib\samples.ts` and change the six paths and the three basket labels to match. For example `/samples/basket-1.jpg`.
- [ ] **5.4** If your products or prices differ from the demo list, edit `DEMO_PRODUCTS` in `src\db\seed.ts`, then run `npm run db:seed`. Prices, names and units of the eight demo products are refreshed each time the seed runs.
- [ ] **5.5** Repeat steps 4.2 and 4.3 with the real photos. All three must give the right cart.

## Part 6. Pending: put the code on GitHub

The repo must be public and show the MIT licence.

- [ ] **6.1** Create a new **public**, empty repository on https://github.com/new called `trustall`. Do not add a README or licence there; the project already has both.
- [ ] **6.2** In PowerShell:

  ```powershell
  cd E:\Hackathon\trustall
  git init
  git add .
  git status
  ```

- [ ] **6.3** Read the `git status` list. **`.env` must not be in it.** If it is, stop and tell me.
- [ ] **6.4** Then:

  ```powershell
  git commit -m "Trustall: honesty box that takes PayPal"
  git branch -M main
  git remote add origin https://github.com/YOUR-USERNAME/trustall.git
  git push -u origin main
  ```

- [ ] **6.5** On the GitHub page, check that the About panel shows **MIT license**.

## Part 7. Pending: deploy on Render and connect the webhook

- [ ] **7.1** Create an account at https://render.com and connect your GitHub.
- [ ] **7.2** **New** > **Blueprint** > pick the `trustall` repo. Render reads `render.yaml` and proposes a web service and a database.
- [ ] **7.3** Fill in the values it asks for:

  | Name | Value |
  | --- | --- |
  | `PAYPAL_CLIENT_ID` | from 2.3 |
  | `PAYPAL_CLIENT_SECRET` | from 2.3 |
  | `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | the Client ID again |
  | `PAYPAL_WEBHOOK_ID` | type `pending` for now |
  | `AI_API_KEY` | from 2.6 |
  | `APP_URL` | type `https://pending.example` for now |
  | `OWNER_DEMO_PASSCODE` | the passcode you want judges to use, for example `meadowlane` |

  If you want the assistant's invoice to reach your sandbox inbox on the live site too, add `DEMO_CAFE_EMAIL` under the service's **Environment** tab before the first deploy finishes.

- [ ] **7.4** Press **Apply** and wait for the deploy to go green. Copy the service URL, like `https://trustall-xxxx.onrender.com`.
- [ ] **7.5** In Render, open the service > **Environment**, set `APP_URL` to that URL (no slash at the end), and save. The QR sign uses it.
- [ ] **7.6** In the PayPal dashboard, open your Trustall app > **Sandbox Webhooks** > **Add Webhook**:
  - URL: `https://trustall-xxxx.onrender.com/api/paypal/webhook`
  - Events: `Payment capture completed`, `Payment capture refunded`, `Invoicing invoice paid`
- [ ] **7.7** Copy the new **Webhook ID**, put it in `PAYPAL_WEBHOOK_ID` on Render, and save. Render redeploys.
- [ ] **7.8** Open `https://trustall-xxxx.onrender.com/api/health`. All four values should now be `true`.
- [ ] **7.9** On a real phone, repeat the tests from Part 4 on the live URL, including a real camera photo. Time the purchase: under 30 seconds after the photo.
- [ ] **7.10** Check the webhook worked: PayPal dashboard > **Event Logs** (Webhooks Events). The `PAYMENT.CAPTURE.COMPLETED` event for your test payment should show as delivered with a 200 response.

  Do not use PayPal's webhook **simulator**. Its events can never pass verification, so the app rejects them on purpose.

- [ ] **7.11** Pay the invoice from 4.6 or 4.11 as the sandbox buyer (sign in at https://www.sandbox.paypal.com with the Personal account). The ledger should flip that sale from Invoiced to **Paid**.

Things to know about Render's free plan:

- The service sleeps when idle, so the first visit can take up to a minute. Open the site shortly before filming and mention this in the README for judges.
- Check how long Render keeps a free database. The demo must stay up until **Dec 15, 2026**. If the free database would expire before then, move to a paid database or to a free Neon database (https://neon.tech) and set `DATABASE_URL` to it.

## Part 8. Pending: README, video and Devpost

- [ ] **8.1** Open `README.md` and fill in the three placeholders near the top: the live URL, the sandbox buyer email and the sandbox buyer password. Change the owner passcode line if you used a different one. Commit and push:

  ```powershell
  git add .
  git commit -m "Add live URL and judge logins"
  git push
  ```

- [ ] **8.2** From a different folder, clone the repo fresh and follow the README to confirm a stranger can run it.
- [ ] **8.3** Print the QR sign from `/owner/sign` on the live site (A5).
- [ ] **8.4** Film the video at the real table, using the script in the project brief. Under 3 minutes, no copyrighted music, no third-party logos. Only show features that worked in your tests.
- [ ] **8.5** Upload it to YouTube as **Public**.
- [ ] **8.6** On Devpost, register for the hackathon and paste the project name, elevator pitch and About text from the brief. Edit every part in `[square brackets]`, and change these to match what was actually built:
  - "How we built it" says **Prisma**: the app uses **Drizzle ORM**.
  - `[model name]`: Anthropic Claude (`claude-sonnet-5-5`, or whatever `AI_MODEL` is).
  - "Built with": `nextjs, typescript, postgresql, drizzle, paypal, paypal-agent-toolkit, anthropic-claude, render, ag-grid`.
  - "invoice the cafe for 5 dozen eggs **every Friday**": recurring invoices are not built. Say one-off invoices.
  - "reference photo crop" in setup: not built.
  - `[Number] real sandbox sales`: use your real count.
- [ ] **8.7** Tick sponsor prizes only for tools really used. The ledger uses **AG Grid** and the app is hosted on **Render**. A project can win only one sponsor prize, so check the rules on Devpost for how to choose.
- [ ] **8.8** Add the live URL, the repo URL and the video link, and submit. Devpost allows edits until the deadline.
- [ ] **8.9** Keep the Render service and database running until Dec 15, 2026.

---

## Not built (optional, only if time allows)

Tell me if you want any of these added:

- Recurring "standing order" invoices
- Reference photo per product
- Editing the price list after setup (today you create a new stall instead)
- Paying each stall owner's own PayPal account (today all stalls pay into the one sandbox business account)

## If something goes wrong

| What you see | What to do |
| --- | --- |
| `... is not set. Add it to .env` | That variable is empty in `.env` (or on Render). Fill it in and restart `npm run dev`. |
| `PayPal rejected the sandbox credentials` | Wrong Client ID or Secret, or they are Live keys. Recopy from the Sandbox tab. |
| PayPal button shows "PayPal did not load" | Check your connection and that the Client ID in `.env` is the sandbox one. |
| PayPal popup says the seller can not accept the payment | You are signed in as the Business account. Use the **Personal** sandbox account. |
| Cart falls back to the item list for every photo | Open http://localhost:3000/api/health. If `ai` is `false`, fix `AI_API_KEY`. If it is `true`, look at Window 2 for the error and send it to me. |
| `npm run db:setup` can not connect | Window 1 (`npm run db:local`) is not running, or port 5432 is used by another Postgres. |
| Sale stays Invoiced after the invoice is paid | The webhook is not connected. Recheck steps 7.6 to 7.8. This only works on the deployed site, not on localhost. |
| Owner page keeps sending you to sign-in | Wrong passcode, or `SESSION_SECRET` changed. Sign in again. |
| Anything else | Send me the on-screen error and the last 20 lines from Window 2. |
