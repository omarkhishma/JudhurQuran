"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import type { RootDetail } from "@/lib/types";

type Row = RootDetail["distribution"][number];

/**
 * Single-series column chart: occurrences per surah in mushaf order (all 114 slots, empty ones
 * shown as a baseline tick so absence is visible). Hover/focus shows the surah and count; a table
 * view carries every value so the tooltip never gates.
 */
export function DistributionChart({ rows, surahNames }: { rows: Row[]; surahNames: { number: number; name_ar: string; name_translit: string }[] }) {
  const t = useTranslations("roots");
  const locale = useLocale();
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const bySurah = useMemo(() => new Map(rows.map((r) => [r.surah, r])), [rows]);
  const max = Math.max(1, ...rows.map((r) => r.occurrences));
  const peak = rows.reduce((a, b) => (b.occurrences > a.occurrences ? b : a), rows[0]);
  const H = 120;
  const hovered = hover != null ? surahNames[hover - 1] : null;
  const hoveredCount = hover != null ? (bySurah.get(hover)?.occurrences ?? 0) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-end">
        <button type="button" className="btn" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          {table ? t("showChart") : t("showTable")}
        </button>
      </div>
      {!table ? (
        <figure className="relative">
          <div
            className="flex items-end gap-[2px] border-b border-line"
            style={{ height: H }}
            dir="rtl"
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label={`${t("distribution")}: ${rows.length} / 114`}
          >
            {surahNames.map((s) => {
              const r = bySurah.get(s.number);
              const h = r ? Math.max(3, (r.occurrences / max) * (H - 18)) : 0;
              return (
                <Link
                  key={s.number}
                  href={`/quran/${s.number}`}
                  className="group relative flex h-full min-w-0 flex-1 items-end"
                  onPointerEnter={() => setHover(s.number)}
                  onFocus={() => setHover(s.number)}
                  tabIndex={r ? 0 : -1}
                  aria-label={`${s.name_ar}: ${formatNumber(r?.occurrences ?? 0, locale)}`}
                >
                  {r ? (
                    <span
                      className="block w-full max-w-[24px] rounded-t-[4px] transition-opacity group-hover:opacity-80"
                      style={{ height: h, background: "var(--chart-root)", opacity: hover && hover !== s.number ? 0.55 : 1 }}
                    />
                  ) : (
                    <span className="block h-[2px] w-full max-w-[24px] bg-line" />
                  )}
                </Link>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-t3" dir="rtl">
            <span>{locale === "ar" ? "الفاتحة" : "1"}</span>
            <span>{locale === "ar" ? "الناس" : "114"}</span>
          </div>
          <figcaption className="mt-2 min-h-[20px] text-[13px] text-t2" aria-live="polite">
            {hovered ? (
              <>
                <strong className="mono text-t1">{formatNumber(hoveredCount, locale)}</strong>{" "}
                <span className="ar-classical" lang="ar">{`سورة ${hovered.name_ar}`}</span>
              </>
            ) : peak ? (
              <>
                <strong className="mono text-t1">{formatNumber(peak.occurrences, locale)}</strong>{" "}
                <span className="ar-classical" lang="ar">{`سورة ${peak.name_ar}`}</span>
              </>
            ) : null}
          </figcaption>
        </figure>
      ) : (
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-t3">
              <th className="py-1 text-start font-normal">{t("surahCol")}</th>
              <th className="py-1 text-end font-normal">{t("countCol")}</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => b.occurrences - a.occurrences).map((r) => (
              <tr key={r.surah} className="border-t border-line">
                <td className="py-1.5">
                  <Link href={`/quran/${r.surah}`} className="hover:underline">
                    <span className="ar-classical text-[16px]" lang="ar">{r.name_ar}</span>{" "}
                    <span className="text-[12px] text-t3">{r.revelation_place === "meccan" ? t("meccan") : t("medinan")}</span>
                  </Link>
                </td>
                <td className="mono py-1.5 text-end">{formatNumber(r.occurrences, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
