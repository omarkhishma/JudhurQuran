import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const API_ORIGIN = process.env.JADHR_API_ORIGIN ?? "http://127.0.0.1:8000";
const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy for production. Next's App Router hydrates through inline scripts, and a
 * nonce would make every page dynamic (no ISR), so inline scripts are allowed but nothing else:
 * no eval, no third-party script, no framing by another site — only the site's own split view frames its
 * pages (P8.6). Audio is the only external origin (EveryAyah). A map's presence is a WebSocket to this site,
 * named outright: some browsers do not count wss: as 'self'. Development gets no CSP: HMR needs eval and
 * websockets.
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const WSS = /^https:\/\//.test(SITE) ? ` ${SITE.replace(/^https:/, "wss:").replace(/\/+$/, "")}` : "";
const CSP = [
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
  "frame-ancestors 'self'",
  // only on an https site: over plain http (a local run of the production build) it would send the split view's
  // frames to an https address nobody answers
  ...(SITE.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  ...(isProd
    ? [
        { key: "Content-Security-Policy", value: CSP },
        // HTTPS-only for a year; preload is left to the owner once the domain is final.
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server for the container image (Dockerfile.web); the monorepo root is the trace root
  // so workspace dependencies are included.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Share images read their fonts from disk at request time.
  outputFileTracingIncludes: { "/**": ["./src/fonts/og/**"] },
  // The public API is served under the same origin (/api/v1/*) so the browser never needs CORS.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_ORIGIN}/api/v1/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
