"use client";

import { useState } from "react";
import { postJson } from "@/lib/client-image";

export default function LoginForm() {
  const [slug, setSlug] = useState("meadow-lane");
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson("/api/owner/login", { slug, passcode });
    if (res.ok) window.location.href = "/owner";
    else {
      setError(res.data.error ?? "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mt-6 space-y-4 p-5">
      <div>
        <label htmlFor="slug" className="font-bold">
          Stall address
        </label>
        <p className="text-sm text-moss">The last part of your stall link, after /s/</p>
        <input id="slug" className="field mt-1" value={slug} onChange={(e) => setSlug(e.target.value)} required autoCapitalize="none" />
      </div>
      <div>
        <label htmlFor="passcode" className="font-bold">
          Passcode
        </label>
        <input
          id="passcode"
          type="password"
          className="field mt-1"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      {error && (
        <p className="card-alert p-3 font-bold text-beet" role="alert">
          {error}
        </p>
      )}
      <button className="btn-sign w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
