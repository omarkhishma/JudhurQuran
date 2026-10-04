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

/** A page's description cut from running text: its spaces as one, no outer space, at most `max` characters ended on a
 * whole word with an ellipsis when cut. */
export function snippet(text: string, max = 160): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max / 2 ? cut.slice(0, at) : cut).trimEnd()}…`;
}
