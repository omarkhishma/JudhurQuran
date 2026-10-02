import type { Metadata } from "next";

/**
 * Canonical URL and hreflang alternates for a page that exists in both locales: Arabic at the bare
 * path (the default), English under /en. Every indexable page sets this itself — inheriting a parent's
 * alternates would point search engines at the wrong page.
 */
export function localized(locale: string, path: string): NonNullable<Metadata["alternates"]> {
  const ar = path;
  const en = path === "/" ? "/en" : `/en${path}`;
  return { canonical: locale === "ar" ? ar : en, languages: { ar, en, "x-default": ar } };
}
