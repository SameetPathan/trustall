"use client";

import { useEffect, useState } from "react";

const SCENES = ["Scan", "Snap", "Pay"] as const;

/** A looping, purely decorative preview of the three steps a customer takes. */
export default function PhoneDemo() {
  const [scene, setScene] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setScene(2);
      return;
    }
    const timer = setInterval(() => setScene((s) => (s + 1) % SCENES.length), 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto w-[17rem]" aria-hidden>
      <span className="float absolute -left-10 top-10 text-5xl" style={{ "--i": 0, "--r": "-12deg" } as React.CSSProperties}>🥚</span>
      <span className="float absolute -right-9 top-24 text-5xl" style={{ "--i": 1, "--r": "10deg" } as React.CSSProperties}>🍯</span>
      <span className="float absolute -left-8 bottom-16 text-5xl" style={{ "--i": 2, "--r": "8deg" } as React.CSSProperties}>🍓</span>
      <span className="float absolute -right-10 bottom-28 text-5xl" style={{ "--i": 3, "--r": "-8deg" } as React.CSSProperties}>🌻</span>

      <div className="relative rounded-[2.6rem] bg-[#07130e] p-2.5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/15">
        <div className="absolute left-1/2 top-4 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[#07130e]" />
        <div className="relative h-[31rem] overflow-hidden rounded-[2rem] bg-whitewash text-ink">
          {/* 1. Scan */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-5 bg-board px-6 text-chalk transition-opacity duration-500 ${scene === 0 ? "opacity-100" : "opacity-0"}`}>
            <div className="scan rounded-3xl bg-white p-4">
              <div className="grid grid-cols-7 gap-1">
                {"1110111100101010111011100101011101001110101011101".split("").map((b, i) => (
                  <span key={i} className={`h-4 w-4 rounded-[3px] ${b === "1" ? "bg-ink" : "bg-transparent"}`} />
                ))}
              </div>
            </div>
            <p className="display text-2xl">Scan the sign</p>
          </div>

          {/* 2. Snap */}
          <div className={`absolute inset-0 flex flex-col transition-opacity duration-500 ${scene === 1 ? "opacity-100" : "opacity-0"}`}>
            <div className="scan flex flex-1 items-center justify-center gap-3 bg-[#a3845c] text-6xl">
              <span>🥚</span>
              <span>🥚</span>
              <span>🍯</span>
            </div>
            <div className="bg-paper px-5 py-5 text-center">
              <p className="display text-xl">Looking at your basket</p>
              <p className="dots mt-2 text-yolk-deep">
                <i />
                <i />
                <i />
              </p>
            </div>
          </div>

          {/* 3. Pay */}
          <div className={`absolute inset-0 flex flex-col gap-2.5 px-4 pb-4 pt-12 transition-opacity duration-500 ${scene === 2 ? "opacity-100" : "opacity-0"}`}>
            <p className="display px-1 text-xl">Is this what you took?</p>
            {[
              ["🥚", "Eggs, dozen", "2", "$10.00"],
              ["🍯", "Wildflower honey", "1", "$8.00"],
            ].map(([icon, name, qty, price], i) => (
              <div key={name} className={`card flex items-center gap-3 p-2.5 ${scene === 2 ? "rise" : ""}`} style={{ "--i": i + 1 } as React.CSSProperties}>
                <span className="icon-tile">{icon}</span>
                <span className="flex-1 text-sm font-bold leading-tight">
                  {name}
                  <span className="block font-medium text-moss">× {qty}</span>
                </span>
                <span className="tabular text-sm font-bold">{price}</span>
              </div>
            ))}
            <div className="mt-auto">
              <p className="flex items-baseline justify-between px-1 pb-2 font-bold">
                <span>Total</span>
                <span className="display tabular text-2xl">$18.00</span>
              </p>
              <div className="rounded-full bg-yolk py-3 text-center text-sm font-extrabold">Pay with PayPal</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-center gap-2">
        {SCENES.map((label, i) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 text-sm font-bold transition-colors duration-300 ${scene === i ? "bg-yolk text-ink" : "bg-white/10 text-chalk/70"}`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
