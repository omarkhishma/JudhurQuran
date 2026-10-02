import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

/**
 * Called by the dataset loader once a release has loaded (jadhr_api.loader). Every server fetch from
 * the API carries the "dataset" tag; a new release may change both content and payload shape, so the
 * tagged data is expired outright ({ expire: 0 }) instead of being served stale while it refreshes.
 *
 * Production requires JADHR_REVALIDATE_SECRET as a bearer token. In development, with no secret set,
 * the endpoint is open so a local reload refreshes the local site.
 */
export async function POST(request: Request) {
  const secret = process.env.JADHR_REVALIDATE_SECRET;
  if (secret) {
    const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!safeEqual(given, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "revalidation is not configured" }, { status: 503 });
  }
  revalidateTag("dataset", { expire: 0 });
  return Response.json({ revalidated: "dataset" });
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
