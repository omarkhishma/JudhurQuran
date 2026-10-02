"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export const NAV_ITEMS = [
  { href: "/quran", key: "read" },
  { href: "/roots", key: "roots" },
  { href: "/graph", key: "graph" },
  { href: "/saved", key: "saved" },
] as const;

export function NavLinks() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("primary")} className="hidden min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] md:block">
      <ul className="flex w-max items-center gap-0.5 rounded-[10px] p-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "inline-flex min-h-[32px] items-center rounded-[7px] px-2.5 text-[13.5px] whitespace-nowrap transition-colors max-[899px]:min-h-[40px] " +
                  (active ? "bg-card font-medium text-t1 shadow-[0_1px_2px_rgba(0,0,0,.06)]" : "text-t2 hover:text-t1")
                }
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
