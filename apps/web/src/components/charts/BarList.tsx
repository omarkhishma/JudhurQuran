"use client";

import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

export type BarItem = { key: string; label: ReactNode; value: number; href?: string; note?: string };

/**
 * A ranked list as bars (P16): one series in one hue, each bar from the same baseline, its value at its tip — every
 * number visible, so the list is its own table. Bars grow from the start edge (the right in Arabic).
 */
export function BarList({ items, hue = "var(--chart-root)", max, format }: { items: BarItem[]; hue?: string; max?: number; format?: (v: number) => string }) {
  const locale = useLocale();
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  const fmt = format ?? ((v: number) => formatNumber(v, locale));
  return (
    <ol className="bar-list">
      {items.map((it, i) => {
        const label = it.href ? (
          <Link href={it.href} prefetch={false} className="bar-label hover:underline">
            {it.label}
          </Link>
        ) : (
          <span className="bar-label">{it.label}</span>
        );
        return (
          <li key={it.key} className="bar-row">
            <span className="mono w-6 shrink-0 text-[10.5px] text-t3">{formatNumber(i + 1, locale)}</span>
            {label}
            <span className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ width: `${(100 * it.value) / top}%`, background: hue }} />
            </span>
            <span className="mono shrink-0 text-[11.5px] text-t2">{fmt(it.value)}</span>
          </li>
        );
      })}
    </ol>
  );
}
