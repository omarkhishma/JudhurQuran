"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Link, usePathname } from "@/i18n/navigation";

/** The shared nav (design 01 §1.4), in its order. `match` decides the active item. */
export const NAV_ITEMS = [
  { href: "/read", key: "read", match: ["/read", "/quran"] },
  // the plain way in, one word at a time (SHL-32: the hub and the shared nav gain Ask)
  { href: "/read?mode=ask", key: "ask", match: [] },
  { href: "/explore", key: "explore", match: ["/explore"] },
  { href: "/library", key: "library", match: ["/library"] },
  { href: "/read?mode=lookup", key: "lookup", match: [] },
  // the Arabic dictionary as its own surface (P11.1): every root of the lexica, the Quran one layer among many
  { href: "/dictionary", key: "dictionary", match: ["/dictionary"] },
  // the hadith collections (P11.2): the Six Books and the Muwaṭṭaʾ, their chains and narrators
  { href: "/hadith", key: "hadith", match: ["/hadith"] },
  // the classical books (P11.3): the shelf's 37 books, every word open to its reading, every paragraph cited
  { href: "/books", key: "books", match: ["/books"] },
  { href: "/concordance", key: "concordance", match: ["/concordance", "/roots"] },
  { href: "/analyse", key: "analyser", match: ["/analyse"] },
  { href: "/stats", key: "stats", match: ["/stats", "/mindmap"] },
  { href: "/graph", key: "graph", match: ["/graph", "/g", "/split"] },
  { href: "/notebook", key: "notebook", match: ["/notebook", "/saved"] },
  { href: "/review", key: "reviewQueue", match: ["/review"] },
  { href: "/classroom", key: "classroom", match: ["/classroom"] },
  { href: "/data", key: "data", match: ["/data", "/developers", "/sources"] },
] as const;

export function isActive(pathname: string, match: readonly string[]): boolean {
  return match.some((m) => pathname === m || pathname.startsWith(m + "/"));
}

/**
 * The nav strip scrolls sideways when it overflows; the page actions beside it stay pinned (a fix the
 * design records). The active item is scrolled into view, so in Arabic the strip starts at the right.
 */
export function NavLinks() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const track = useRef<HTMLUListElement>(null);

  useEffect(() => {
    // the active item to the strip's middle, clear of the faded edges
    track.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  // a fade at each edge the strip runs past, so an item cut there reads as "more this way", not as a fault (audit 27 F31)
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft); // right to left, scrollLeft runs negative
      el.toggleAttribute("data-fade-start", max > 1 && pos > 1);
      el.toggleAttribute("data-fade-end", max > 1 && pos < max - 1);
    };
    // when the strip's size settles (fonts load after the first layout), the active item is brought back if it was cut —
    // on a resize only, never while the reader scrolls the strip
    const settle = () => {
      const a = el.querySelector<HTMLElement>("[aria-current=page]");
      if (a) {
        const r = a.getBoundingClientRect();
        const t = el.getBoundingClientRect();
        if (r.left < t.left || r.right > t.right) a.scrollIntoView({ block: "nearest", inline: "center" });
      }
      update();
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(settle);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <nav aria-label={t("primary")} className="hidden min-w-0 shrink min-[900px]:block">
      <ul ref={track} className="nav-track">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.match);
          return (
            <li key={item.key}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className="nav-item">
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
