import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { allow, FRESH, isLoopback, keyOf } from "./lib/pageLimit";

const intl = createMiddleware(routing);

// pages a minute for one address, and pages that read the API afresh for each question (lib/pageLimit)
const PAGES = Number(process.env.JADHR_PAGE_RATE_PER_MINUTE) || 1200;
const FRESH_PAGES = Number(process.env.JADHR_FRESH_PAGE_RATE_PER_MINUTE) || 120;

export default function proxy(request: NextRequest) {
  // counted by the address Caddy names, never this machine's own (Next names the socket's when no proxy did)
  const address = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (address && !isLoopback(address)) {
    const key = keyOf(address);
    const path = request.nextUrl.pathname;
    const fresh = FRESH.test(path) ? allow(`fresh:${key}`, FRESH_PAGES) : { ok: true, retry: 0 };
    const page = fresh.ok ? allow(`page:${key}`, PAGES) : fresh;
    if (!page.ok)
      return new Response("طلبات كثيرة من هنا؛ أعد المحاولة بعد قليل.\nToo many requests from here; try again shortly.\n", {
        status: 429,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(page.retry), "Cache-Control": "no-store" },
      });
  }
  return intl(request);
}

export const config = {
  // Everything except API proxying, Next internals and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
