import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trustall: the honesty box that takes PayPal",
  description: "Scan, snap what you took, pay. AI builds the cart from a photo and shows stall owners how honest their customers are.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0c1f17" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <p className="no-print flex items-center justify-center gap-2 bg-board px-3 py-1.5 text-center text-[0.8125rem] font-semibold text-chalk">
          <span className="inline-block h-2 w-2 rounded-full bg-yolk" aria-hidden />
          Sandbox demo, no real money
        </p>
        {children}
      </body>
    </html>
  );
}
