"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";
import { isActive, NAV_ITEMS } from "./NavLinks";

export function MobileMenu() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  // The menu belongs to the page it was opened on: navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((x: boolean) => boolean)) =>
    setOpenOn((typeof v === "function" ? v(open) : v) ? pathname : null);
  const panelRef = useRef<HTMLDivElement>(null);

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
            className="popover fixed inset-x-3 top-[58px] z-40 p-2"
            role="dialog"
            aria-label={t("primary")}
          >
            <ul className="flex flex-col">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.match);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={"flex min-h-[48px] items-center rounded-lg px-3 text-[15px] " + (active ? "bg-card-2 font-medium" : "")}
                    >
                      {t(item.key)}
                    </Link>
                  </li>
                );
              })}
              <li className="my-1 border-t border-line" />
              {(["me", "about", "sources", "privacy"] as const).map((k) => (
                <li key={k}>
                  <Link href={k === "me" ? "/me" : `/${k}`} className="flex min-h-[44px] items-center rounded-lg px-3 text-[14px] text-t2">
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
