"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/store";
import { useIsClient } from "@/lib/client";

/**
 * The shared nav in five groups by what the reader came to do (audit 27, P-UX1: fifteen items of one weight ran past
 * the header at 1440 and gave no sense of the whole). Each item is a hub destination, with its title and purpose
 * line from `hub.dest`; `match` decides the active item and so the active group.
 */
export type NavItem = { key: string; href: string; match: readonly string[]; role?: "reviewer" | "board" };
export type NavGroup = { key: "read" | "find" | "understand" | "draw" | "mine"; wide?: boolean; items: readonly NavItem[] };

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    key: "read",
    wide: true,
    items: [
      { key: "read", href: "/read", match: ["/read", "/quran", "/mushaf"] },
      { key: "library", href: "/library", match: ["/library"] },
      // the hadith collections (P11.2) and the classical books (P11.3)
      { key: "hadith", href: "/hadith", match: ["/hadith"] },
      { key: "books", href: "/books", match: ["/books"] },
      { key: "explore", href: "/explore", match: ["/explore"] },
    ],
  },
  {
    key: "find",
    wide: true,
    items: [
      { key: "search", href: "/search", match: ["/search"] },
      // the plain way in, one word at a time (SHL-32)
      { key: "ask", href: "/read?mode=ask", match: [] },
      { key: "lookup", href: "/read?mode=lookup", match: [] },
      { key: "dictionary", href: "/dictionary", match: ["/dictionary"] },
      { key: "roots", href: "/roots", match: ["/roots"] },
      { key: "concordance", href: "/concordance", match: ["/concordance"] },
      { key: "analyser", href: "/analyse", match: ["/analyse"] },
    ],
  },
  {
    key: "understand",
    items: [
      { key: "askQuran", href: "/ask", match: ["/ask"] },
      { key: "stats", href: "/stats", match: ["/stats"] },
      { key: "mindmap", href: "/mindmap", match: ["/mindmap"] },
    ],
  },
  {
    key: "draw",
    items: [
      { key: "graph", href: "/graph", match: ["/graph"] },
      { key: "published", href: "/g", match: ["/g"] },
      { key: "split", href: "/split", match: ["/split"] },
    ],
  },
  {
    key: "mine",
    items: [
      { key: "notebook", href: "/notebook", match: ["/notebook"] },
      { key: "saved", href: "/saved", match: ["/saved"] },
      { key: "review", href: "/read?mode=review", match: [] },
      { key: "classroom", href: "/classroom", match: ["/classroom"] },
      { key: "profile", href: "/me", match: ["/me"] },
      // the work of those who hold a role, shown to them only (the proposals stay open to all from the footer's «ساهم»)
      { key: "reviewQueue", href: "/review", match: ["/review"], role: "reviewer" },
      { key: "workbench", href: "/workbench", match: ["/workbench"], role: "board" },
    ],
  },
];

export function isActive(pathname: string, match: readonly string[]): boolean {
  return match.some((m) => pathname === m || pathname.startsWith(m + "/"));
}

const REVIEWERS = new Set(["reviewer", "editor", "admin"]);
const BOARD = new Set(["editor", "admin"]);

/** The groups' items this reader sees: a role's items only to its holders. */
export function useNavGroups(): readonly NavGroup[] {
  const client = useIsClient();
  const role = useAccount((s) => s.user?.role);
  const holds = (r: NavItem["role"]) => !r || (client && !!role && (r === "board" ? BOARD : REVIEWERS).has(role));
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => holds(i.role)) }));
}

/** The group the current page belongs to, if any. */
export const activeGroup = (groups: readonly NavGroup[], pathname: string) =>
  groups.find((g) => g.items.some((i) => isActive(pathname, i.match)))?.key ?? null;

/**
 * Five disclosure buttons, each opening its panel of destinations (the disclosure navigation pattern, not an ARIA menu:
 * the links stay links). Arrows move through a panel, Escape closes it and returns to its button, a press outside or
 * leaving it with Tab closes it; while one is open, pointing at another button opens that one.
 */
export function NavLinks() {
  const t = useTranslations("nav");
  const th = useTranslations("hub.dest");
  const pathname = usePathname();
  const groups = useNavGroups();
  const current = activeGroup(groups, pathname);
  const base = useId();
  // the open group belongs to the page it was opened on: navigating closes it
  const [openAt, setOpenAt] = useState<{ key: string; on: string } | null>(null);
  const open = openAt?.on === pathname ? openAt.key : null;
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenAt(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const button = (key: string) => root.current?.querySelector<HTMLButtonElement>(`[data-group="${key}"]`);
  const links = (key: string) => Array.from(root.current?.querySelectorAll<HTMLAnchorElement>(`#${CSS.escape(base + key)} a`) ?? []);
  const openGroup = (key: string, focus?: "first" | "last") => {
    setOpenAt({ key, on: pathname });
    if (focus) requestAnimationFrame(() => (focus === "first" ? links(key)[0] : links(key).at(-1))?.focus());
  };

  return (
    <nav ref={root} aria-label={t("primary")} className="hidden min-w-0 shrink min-[900px]:block">
      <ul className="nav-track">
        {groups.map((g) => {
          const id = base + g.key;
          const isOpen = open === g.key;
          return (
            <li
              key={g.key}
              className="nav-group"
              onBlur={(e) => {
                // Tab out of the group closes it
                if (isOpen && !e.currentTarget.contains(e.relatedTarget as Node)) setOpenAt(null);
              }}
            >
              <button
                type="button"
                className="nav-item"
                data-group={g.key}
                data-current={current === g.key || undefined}
                aria-expanded={isOpen}
                aria-controls={id}
                onClick={() => (isOpen ? setOpenAt(null) : openGroup(g.key))}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse" && open && open !== g.key) openGroup(g.key);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    openGroup(g.key, e.key === "ArrowDown" ? "first" : "last");
                  } else if (e.key === "Escape" && isOpen) setOpenAt(null);
                }}
              >
                {t(`groups.${g.key}`)}
                {current === g.key && <span className="sr-only"> {t("currentGroup")}</span>}
                <svg className="nav-chev" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div
                id={id}
                className={"nav-panel popover" + (g.wide ? " is-wide" : "")}
                hidden={!isOpen}
                onKeyDown={(e) => {
                  const all = links(g.key);
                  const i = all.indexOf(document.activeElement as HTMLAnchorElement);
                  const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
                  if (step) {
                    e.preventDefault();
                    all[(i + step + all.length) % all.length]?.focus();
                  } else if (e.key === "Home" || e.key === "End") {
                    e.preventDefault();
                    (e.key === "Home" ? all[0] : all.at(-1))?.focus();
                  } else if (e.key === "Escape") {
                    setOpenAt(null);
                    button(g.key)?.focus();
                  }
                }}
              >
                <ul>
                  {g.items.map((item) => {
                    const active = isActive(pathname, item.match);
                    return (
                      <li key={item.key}>
                        {/* the link is named by its title; its purpose line describes it */}
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          aria-describedby={`${id}-${item.key}`}
                          className="nav-link"
                          onClick={() => setOpenAt(null)}
                        >
                          <span className="nav-link-title">{th(`${item.key}.title`)}</span>
                          <span className="nav-link-purpose" id={`${id}-${item.key}`} aria-hidden="true">
                            {th(`${item.key}.purpose`)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
