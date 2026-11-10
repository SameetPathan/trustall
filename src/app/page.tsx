import Link from "next/link";
import { SAMPLE_BASKETS, SAMPLE_SHELVES } from "@/lib/samples";

const steps = [
  ["01", "Scan the sign", "Your stall opens straight from its QR code. No download or account needed."],
  ["02", "Snap your basket", "One photo becomes an itemised cart. Check the quantities and make it yours."],
  ["03", "Pay & be on your way", "Pay with PayPal, or request an invoice. Your receipt is ready when you are."],
];

export default function Home() {
  return (
    <main className="home-page">
      <section className="market-hero">
        <div className="market-intro">
          <p className="overline"><span className="status-dot" /> A little trust goes a long way</p>
          <h1>Fresh picks.<br />Fair pay.<br /><span>All on trust.</span></h1>
          <p className="hero-description">The little honesty stall, with a smarter way to pay. Pick something good, snap a photo, and let Trustall take care of the checkout.</p>
          <div className="hero-actions">
            <Link href="/s/meadow-lane" className="btn-sign">Explore the demo stall <span aria-hidden>↗</span></Link>
            <Link href="/owner/setup" className="text-link">I run a stall <span aria-hidden>→</span></Link>
          </div>
          <p className="hero-footnote">No cash to carry. No app to download.</p>
        </div>
        <div className="market-visual">
          <div className="photo-label"><span className="status-dot" /> THE HONESTY STALL</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="market-photo" src={SAMPLE_SHELVES.OPEN} alt="Fresh bread, eggs, honey and vegetables on the shelves of a farm stall" fetchPriority="high" />
          <div className="market-receipt">
            <div className="receipt-check" aria-hidden>✓</div>
            <div><p className="receipt-title">Picked. Snapped. Paid.</p><p className="receipt-detail">Your everyday checkout, simplified.</p></div>
          </div>
          <p className="photo-caption">Good things grow when we trust each other.</p>
        </div>
      </section>

      <section className="how-section" aria-labelledby="how-title">
        <div className="section-heading"><p className="overline">A small ritual. A simpler checkout.</p><h2 id="how-title">Three steps. Then enjoy.</h2></div>
        <ol className="steps-grid">
          {steps.map(([number, title, description]) => (
            <li key={number}><span className="step-number">{number}</span><div><h3>{title}</h3><p>{description}</p></div></li>
          ))}
        </ol>
      </section>

      <section className="basket-section" aria-labelledby="basket-title">
        <div className="section-heading section-heading-row">
          <div><p className="overline">A taste of Trustall</p><h2 id="basket-title">What’s in your basket?</h2></div>
          <p>Try a sample from Meadow Lane.<br />A real flow, with sandbox payments.</p>
        </div>
        <div className="basket-grid">
          {SAMPLE_BASKETS.map((basket, index) => (
            <Link href="/s/meadow-lane" key={basket.src} className="basket-card">
              <div className="basket-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={basket.src} alt={basket.label} loading="lazy" />
                <span className="basket-index">BASKET 0{index + 1}</span>
                <span className="basket-arrow" aria-hidden>↗</span>
              </div>
              <div className="basket-description"><h3>{["The breakfast basket", "A little of everything", "Fresh from the garden"][index]}</h3><span>{["$18", "$17", "$22"][index]}</span></div>
              <p>{basket.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="owner-feature" aria-labelledby="owner-title">
        <div className="owner-feature-copy">
          <p className="overline">For the hands behind the harvest</p>
          <h2 id="owner-title">Your stall.<br />A clearer picture.</h2>
          <p>See what sold, keep an eye on the shelf, and get a hand with the everyday admin. More time for the things you grow.</p>
          <Link href="/owner" className="btn-sign">Open the owner view <span aria-hidden>↗</span></Link>
          <Link href="/owner/setup" className="owner-setup-link">New here? Set up your stall →</Link>
        </div>
        <div className="owner-preview">
          <div className="preview-heading"><span>MEADOW LANE</span><span className="preview-demo">Example day</span></div>
          <div className="preview-score"><div><p>Honesty score</p><strong>88<span>%</span></strong></div><div className="score-ring" aria-label="Example honesty score 88 percent">88%</div></div>
          <p className="preview-explanation">What left the shelf, compared with what was paid for.</p>
          <div className="preview-sale"><span>Eggs · 2 dozen</span><span className="paid-status">Paid</span><strong>$10.00</strong></div>
          <div className="preview-sale"><span>Wildflower honey</span><span className="paid-status">Paid</span><strong>$8.00</strong></div>
          <p className="preview-footer">Live ledger · Shelf checks · Owner assistant</p>
        </div>
      </section>

      <section className="how-section" aria-labelledby="trust-title">
        <div className="section-heading"><p className="overline">Built so nobody has to take it on faith</p><h2 id="trust-title">AI reads. Code counts. PayPal confirms.</h2></div>
        <ol className="steps-grid">
          {[
            ["AI", "AI reads the photo", "A vision model matches the basket, the price board or the shelf to the stall\u2019s own list. It never sets a price."],
            ["=", "Code does the arithmetic", "Every total is worked out on the server from the stall\u2019s price list, in whole cents."],
            ["\u2713", "PayPal is the truth", "Orders, invoices, refunds and verified webhooks decide whether money moved. The assistant acts only after the owner confirms."],
          ].map(([mark, title, description]) => (
            <li key={title}><span className="step-number">{mark}</span><div><h3>{title}</h3><p>{description}</p></div></li>
          ))}
        </ol>
      </section>

      <footer className="home-footer"><Link href="/" className="wordmark">Trustall<span aria-hidden>✳</span></Link><p>A modern way to keep the honesty stall honest.</p><span>Built for the PayPal AI Hackathon · Sandbox demo</span></footer>
    </main>
  );
}
