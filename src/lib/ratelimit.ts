/** Small in-memory limiter to keep a public demo from running up an AI bill. */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function allow(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function clientKey(req: Request, scope: string): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${scope}:${ip}`;
}
