import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const API_ORIGIN = process.env.JADHR_API_ORIGIN ?? "http://127.0.0.1:8000";
const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy for production. Next's App Router hydrates through inline scripts, and a
 * nonce would make every page dynamic (no ISR), so inline scripts are allowed but nothing else:
 * no eval, no third-party script, no framing by another site — only the site's own split view frames its
 * pages (P8.6) — except a published map's embed, which any site may frame (P8.5, EDT-333). Audio is the only
 * external origin (EveryAyah). A map's presence is a WebSocket to this site, named outright: some browsers do
 * not count wss: as 'self'. Development gets no CSP: HMR needs eval and websockets.
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const WSS = /^https:\/\//.test(SITE) ? ` ${SITE.replace(/^https:/, "wss:").replace(/\/+$/, "")}` : "";
const csp = (ancestors: string) => [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' https://everyayah.com",
  `connect-src 'self'${WSS}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `frame-ancestors ${ancestors}`,
  // only on an https site: over plain http (a local run of the production build) it would send the split view's
  // frames to an https address nobody answers
  ...(SITE.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  // HTTPS-only for a year; preload is left to the owner once the domain is final.
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];
/** Every page but an embed: framed by this site alone. */
const FRAMED_BY_SELF = [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...(isProd ? [{ key: "Content-Security-Policy", value: csp("'self'") }] : [])];
/** A published map's embed (`/embed/…`, `/en/embed/…`): framed by any site, with no X-Frame-Options to forbid it. */
const FRAMED_BY_ANY = isProd ? [{ key: "Content-Security-Policy", value: csp("*") }] : [];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server for the container image (Dockerfile.web); the monorepo root is the trace root
  // so workspace dependencies are included.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Share images read their fonts from disk at request time; the Quran's text in them is shaped by HarfBuzz (B7),
  // loaded from node_modules with its WebAssembly beside it.
  outputFileTracingIncludes: { "/**": ["./src/fonts/og/**", "./src/fonts/UthmanicHafs_V22.ttf", "./node_modules/harfbuzzjs/dist/harfbuzz.wasm"] },
  serverExternalPackages: ["harfbuzzjs"],
  // The public API is served under the same origin (/api/v1/*) so the browser never needs CORS.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_ORIGIN}/api/v1/:path*` }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // the offline worker is asked for afresh on every visit, so a release replaces it at once
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0" }] },
      { source: "/", headers: FRAMED_BY_SELF },
      { source: "/:path((?!embed/|en/embed/).+)", headers: FRAMED_BY_SELF },
      { source: "/embed/:path*", headers: FRAMED_BY_ANY },
      { source: "/en/embed/:path*", headers: FRAMED_BY_ANY },
      // a route with no headers is refused by Next: in development an embed has none (its CSP is production's)
    ].filter((r) => r.headers.length > 0);
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
