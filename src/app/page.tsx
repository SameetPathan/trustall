import Link from "next/link";
import PhoneDemo from "@/components/PhoneDemo";

const STEPS = [
  { icon: "📷", title: "Scan the sign", body: "A printed QR code on the table opens the stall. No app, no account." },
  { icon: "🧺", title: "Snap your basket", body: "One photo of what you are taking. AI matches it to the stall's price list." },
  { icon: "✅", title: "Check and pay", body: "Fix anything the photo got wrong, then pay with PayPal or ask for an invoice." },
];

export default function Home() {
  return (
    <main>
      <section className="hero overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-16">
          <div>
            <p className="display text-2xl">
              Trust<span className="text-yolk">all</span>
            </p>
            <h1 className="mt-10 text-[2.9rem] leading-[0.98] sm:text-7xl">The honesty box that takes PayPal.</h1>
            <p className="mt-6 max-w-xl text-lg text-chalk/85 sm:text-xl">
              Customers at an unattended stall scan, snap a photo of what they took, and pay. Owners see every
              sale, and find out how honest the day was.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/s/meadow-lane" className="btn-sign">
                Try the demo stall
              </Link>
              <Link href="/owner" className="btn-ghost-dark">
                Open the owner view
              </Link>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-white/15 pt-6">
              {[
                ["1 photo", "builds the whole cart"],
                ["0 apps", "nothing to install"],
                ["30 sec", "from photo to paid"],
              ].map(([big, small]) => (
                <div key={big}>
                  <dt className="display text-2xl text-yolk sm:text-3xl">{big}</dt>
                  <dd className="mt-1 text-sm text-chalk/75">{small}</dd>
                </div>
              ))}
            </dl>
          </div>
          <PhoneDemo />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="max-w-xl text-4xl sm:text-5xl">Three steps at the table</h2>
        <ol className="mt-9 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-6">
              <div className="flex items-center justify-between">
                <span className="icon-tile !h-14 !w-14 !text-3xl">{s.icon}</span>
                <span className="display text-5xl text-line">{i + 1}</span>
              </div>
              <h3 className="display mt-5 text-2xl">{s.title}</h3>
              <p className="mt-2 text-moss">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="max-w-2xl text-4xl sm:text-5xl">What the owner gets</h2>
        <div className="mt-9 grid gap-5 lg:grid-cols-3">
          {/* honesty score */}
          <div className="card-dark p-7 text-chalk lg:row-span-2">
            <p className="font-bold text-yolk">Honesty score</p>
            <p className="display mt-3 text-[5.5rem] leading-none">88%</p>
            <p className="mt-4 text-chalk/85">
              Photograph the shelf in the morning and the evening. Trustall counts the stock and compares what
              left the shelf with what was paid for.
            </p>
            <div className="mt-6 space-y-2.5 text-sm">
              {[
                ["🥚 Eggs", "6 gone", "5 paid"],
                ["🍯 Honey", "2 gone", "2 paid"],
                ["🍓 Jam", "1 gone", "1 paid"],
              ].map(([name, gone, paid]) => (
                <p key={name} className="flex justify-between rounded-xl bg-white/10 px-3.5 py-2.5">
                  <span className="font-bold">{name}</span>
                  <span className="text-chalk/80">
                    {gone}, {paid}
                  </span>
                </p>
              ))}
            </div>
            <p className="mt-5 text-sm text-chalk/60">Example figures.</p>
          </div>

          {/* ledger */}
          <div className="card p-7 lg:col-span-2">
            <p className="font-bold text-leaf-deep">Live ledger</p>
            <h3 className="display mt-2 text-3xl">Every sale, item by item</h3>
            <p className="mt-2 max-w-lg text-moss">A sale shows as paid only when PayPal confirms it, by capture or a verified webhook.</p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {[
                ["Paid", "bg-leaf text-paper", "2 × Eggs, 1 × Honey", "$18.00"],
                ["Invoiced", "bg-yolk text-ink", "1 × Sourdough loaf", "$7.00"],
              ].map(([status, tone, items, total]) => (
                <div key={status} className="rounded-2xl bg-whitewash p-4">
                  <div className="flex items-center justify-between">
                    <span className={`pill ${tone}`}>{status}</span>
                    <span className="display tabular text-xl">{total}</span>
                  </div>
                  <p className="mt-2 text-sm text-moss">{items}</p>
                </div>
              ))}
            </div>
          </div>

          {/* assistant */}
          <div className="card p-7">
            <p className="font-bold text-leaf-deep">Assistant</p>
            <h3 className="display mt-2 text-2xl">Acts through PayPal, after you confirm</h3>
            <div className="mt-4 space-y-2 text-sm">
              <p className="ml-6 rounded-2xl rounded-br-md bg-board px-3.5 py-2.5 text-chalk">Refund the last honey sale.</p>
              <div className="card-note mr-4 p-3.5">
                <p className="font-bold">Refund $8.00 for 1 × Wildflower honey</p>
                <p className="mt-2 flex gap-2">
                  <span className="pill bg-yolk">Confirm</span>
                  <span className="pill bg-paper">Cancel</span>
                </p>
              </div>
            </div>
          </div>

          {/* setup */}
          <div className="card p-7">
            <p className="font-bold text-leaf-deep">Setup</p>
            <h3 className="display mt-2 text-2xl">A stall from one photo</h3>
            <p className="mt-2 text-moss">Photograph your price board, check the drafted list, print the QR sign.</p>
            <Link href="/owner/setup" className="btn-plain mt-5">
              Set up your own stall
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="card grid gap-8 p-8 md:grid-cols-3">
          {[
            ["🤖", "AI reads photos", "Vision turns a basket, a price board or a shelf into structured data. It never sets a price."],
            ["🧮", "Code does the arithmetic", "Totals come from the stall's own price list on the server, in whole cents."],
            ["🔒", "PayPal is the truth", "Orders, invoices, refunds and verified webhooks decide whether money moved."],
          ].map(([icon, title, body]) => (
            <div key={title}>
              <span className="icon-tile">{icon}</span>
              <h3 className="display mt-4 text-xl">{title}</h3>
              <p className="mt-1.5 text-moss">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-moss">Built for the PayPal AI Hackathon. Everything here runs in the PayPal sandbox.</p>
      </section>
    </main>
  );
}
