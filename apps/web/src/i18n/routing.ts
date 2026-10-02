import { defineRouting } from "next-intl/routing";

// Arabic is the canonical language and lives at the root; English under /en.
// No Accept-Language redirect: the canonical Arabic URLs must never flip by header.
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "as-needed",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
