"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";

type Coverage = { surahs: { surah: number; verses: number; covered: number; placed: number }[]; verses: number; covered: number; placed: number };
type SurahName = { number: number; name_ar: string; name_translit: string };

const pct = (x: number, locale: string) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent", maximumFractionDigits: 0 }).format(x);

/**
 * Where the topics stop (B43): the 114 sūras, each a cell shaded by the share of its verses a topic gathers —
 * Quranpedia's, then the editorial board's placements — one hue, light to dark, so the index's gaps are plain to see.
 * Each cell names its sūra and its numbers on hover; the same numbers are a table, which a screen reader reads. For the
 * board (`onPick`) a cell is a button that lists the sūra's verses waiting on a topic; for a reader in the editor it is
 * only shown, so the map is never left.
 */
export function TopicCoverage({ onPick, heading = true }: { onPick?: (surah: number) => void; heading?: boolean }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const cov = useQuery({ queryKey: ["topics-coverage"], queryFn: () => getJSON<Coverage>("/topics/coverage"), staleTime: 10 * 60_000 });
  const names = useQuery({ queryKey: ["surahs"], queryFn: () => getJSON<{ data: SurahName[] }>("/surahs"), staleTime: Infinity });
  if (!cov.data || !names.data) return <div className="h-24 animate-pulse rounded-lg bg-card-2" aria-hidden="true" />;
  const name = (n: number) => {
    const s = names.data.data.find((x) => x.number === n);
    return s ? (locale === "ar" ? s.name_ar : s.name_translit) : formatNumber(n, locale);
  };
  const d = cov.data;
  const label = (r: Coverage["surahs"][number]) =>
    t("coverageCell", { name: name(r.surah), covered: formatNumber(r.covered + r.placed, locale), verses: formatNumber(r.verses, locale) }) +
    (r.placed ? ` — ${t("coveragePlaced", { n: formatNumber(r.placed, locale) })}` : "");
  return (
    <section className="flex flex-col gap-2" aria-label={t("coverageTitle")}>
      {/* where a fold above already names it, not named twice */}
      {heading && <h3 className="text-[13.5px] font-semibold">{t("coverageTitle")}</h3>}
      <p className="text-[12px] leading-relaxed text-t2">
        {t("coverageLead", { covered: formatNumber(d.covered + d.placed, locale), verses: formatNumber(d.verses, locale), pct: pct((d.covered + d.placed) / d.verses, locale), placed: formatNumber(d.placed, locale) })}
      </p>
      <ol className="topic-coverage" aria-label={onPick ? t("coverageTitle") : undefined} aria-hidden={onPick ? undefined : true}>
        {d.surahs.map((r) => {
          const share = r.verses ? (r.covered + r.placed) / r.verses : 0;
          const style = { background: `color-mix(in srgb, var(--c-desc) ${Math.round(share * 100)}%, var(--card))` };
          const text = label(r);
          return (
            <li key={r.surah}>
              {onPick ? (
                <button type="button" className="topic-cell" style={style} title={text} aria-label={text} onClick={() => onPick(r.surah)} />
              ) : (
                <span className="topic-cell" style={style} title={text} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="flex items-center gap-2 text-[11px] text-t3" aria-hidden="true">
        <span>{t("coverageNone")}</span>
        <span className="topic-coverage-ramp" />
        <span>{t("coverageAll")}</span>
      </p>
      <details className="text-[12px]">
        <summary className="cursor-pointer text-t2">{t("coverageTable")}</summary>
        <table className="mt-2 w-full text-[12px]">
          <thead>
            <tr className="text-t3">
              <th scope="col" className="text-start font-medium">{t("coverageSurah")}</th>
              <th scope="col" className="text-end font-medium">{t("coverageVerses")}</th>
              <th scope="col" className="text-end font-medium">{t("coverageCovered")}</th>
              <th scope="col" className="text-end font-medium">{t("coverageByBoard")}</th>
            </tr>
          </thead>
          <tbody>
            {d.surahs.map((r) => (
              <tr key={r.surah} className="border-t border-line">
                <th scope="row" className="text-start font-normal">{`${formatNumber(r.surah, locale)}. ${name(r.surah)}`}</th>
                <td className="text-end">{formatNumber(r.verses, locale)}</td>
                <td className="text-end">{formatNumber(r.covered, locale)}</td>
                <td className="text-end">{formatNumber(r.placed, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
