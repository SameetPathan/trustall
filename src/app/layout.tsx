import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trustall: the honesty box that takes PayPal",
  description: "Scan, snap what you took, pay. AI builds the cart from a photo and shows stall owners how honest their customers are.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#244d3e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="no-print site-header">
          <p className="bg-ink px-3 py-1 text-center text-xs font-bold tracking-wide text-chalk">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-yolk align-middle" aria-hidden />
            Sandbox demo, no real money
          </p>
          <div className="site-nav">
            <Link href="/" className="wordmark" aria-label="Trustall home">
              <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden>
                <rect width="32" height="32" rx="10" fill="currentColor" />
                <path d="M8 15h16l-2 9H10zm3 0 5-7 5 7m-5 3v3" fill="none" stroke="#e4f492" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Trustall
            </Link>
            <nav className="site-links" aria-label="Main navigation"><Link href="/" className="site-home">Home</Link><Link href="/owner" className="site-owner">Owner view <span aria-hidden>↗</span></Link></nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
