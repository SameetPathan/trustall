"use client";

/**
 * Shrinks a photo in the browser to a JPEG data URL (longest side 1280 px).
 * Phone photos are 3 to 12 MB; this makes uploads fast on a rural signal and
 * keeps the vision call quick. Also turns the SVG samples into JPEGs.
 */
export async function toJpegDataUrl(source: File | string, maxSide = 1280): Promise<string> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file could not be opened as a picture."));
      el.src = url;
    });
    const w = img.naturalWidth || 1200;
    const h = img.naturalHeight || 900;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can not prepare the photo.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

export async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({ error: "The server sent an answer we could not read." }));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "No connection. Check your signal and try again." } as T & { error?: string } };
  }
}

export function money(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
