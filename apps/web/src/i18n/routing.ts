import { defineRouting } from "next-intl/routing";

// Arabic is the canonical language and lives at the root; English under /en.
// No Accept-Language redirect: the canonical Arabic URLs must never flip by header.
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "as-needed",
  localeDetection: false,
  // No cookie: nothing reads it (no detection), and a Set-Cookie on every response stops CDNs from caching pages.
  localeCookie: false,
  // hreflang is declared per page (src/lib/seo.ts); a second, header-based copy could only disagree with it.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
