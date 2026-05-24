export function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

type Bucket = { hits: number[] };

const globalForRateLimit = globalThis as unknown as { buckets?: Map<string, Bucket> };
const buckets = globalForRateLimit.buckets ?? new Map<string, Bucket>();
if (process.env.NODE_ENV !== "production") globalForRateLimit.buckets = buckets;

export function rateLimit(args: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const start = now - args.windowMs;

  const bucket = buckets.get(args.key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > start);

  if (bucket.hits.length >= args.limit) {
    const oldest = bucket.hits[0]!;
    const retryAfterMs = Math.max(0, oldest + args.windowMs - now);
    buckets.set(args.key, bucket);
    return { ok: false, retryAfterMs };
  }

  bucket.hits.push(now);
  buckets.set(args.key, bucket);
  return { ok: true };
}

