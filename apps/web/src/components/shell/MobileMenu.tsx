"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";
import { activeGroup, isActive, useNavGroups } from "./NavLinks";

/** The phone's menu: the header's five groups, each under its name, two titles to a row so the whole fits a glance. */
export function MobileMenu() {
  const t = useTranslations("nav");
  const th = useTranslations("hub.dest");
  const groups = useNavGroups();
  const tc = useTranslations("common");
  const pathname = usePathname();
  // The menu belongs to the page it was opened on: navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((x: boolean) => boolean)) =>
    setOpenOn((typeof v === "function" ? v(open) : v) ? pathname : null);
  const panelRef = useRef<HTMLDivElement>(null);
  const current = activeGroup(groups, pathname);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-[900px]:hidden">
      <button
        type="button"
        className="btn icon-btn"
        aria-label={tc("menu")}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? "close" : "menu"} size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 top-[52px] z-30 bg-[rgba(10,10,16,.28)] animate-fade" onClick={() => setOpen(false)} />
          <div
            id="mobile-menu"
            ref={panelRef}
            className="popover mobile-menu fixed inset-x-3 top-[58px] z-40 p-2"
            role="dialog"
            aria-label={t("primary")}
          >
            {groups.map((g) => (
              <section key={g.key} aria-labelledby={`mm-${g.key}`} className="mobile-menu-group" data-current={current === g.key || undefined}>
                <h2 id={`mm-${g.key}`} className="mobile-menu-title">
                  {t(`groups.${g.key}`)}
                </h2>
                <ul className="mobile-menu-grid">
                  {g.items.map((item) => {
                    const active = isActive(pathname, item.match);
                    return (
                      <li key={item.key}>
                        <Link href={item.href} aria-current={active ? "page" : undefined} className="mobile-menu-link" onClick={() => setOpen(false)}>
                          {th(`${item.key}.title`)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <ul className="mobile-menu-foot">
              {(["about", "sources", "data", "privacy"] as const).map((k) => (
                <li key={k}>
                  <Link href={`/${k}`} className="mobile-menu-quiet" onClick={() => setOpen(false)}>
                    {t(k)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
