"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { usePrefs, useReader } from "@/lib/reader/store";
import type { WordPayload } from "@/lib/reader/types";

const TICKS = [600, 800, 1000, 1200, 1400, 1600, 1800];

/**
 * Across the centuries (design 03 §3.5.5, RDR-254…262): dictionaries by their author's death year and
 * the Quran (632) on one axis, 550–1920 CE. A dot means "this dictionary has an article on the root";
 * which sense each one attests is drawn only once senses are linked to sources (P3.4a) — until then
 * the lanes-per-sense and stream views say so instead of showing a placeholder mapping.
 */
export function CenturiesSection({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const dictOff = usePrefs((s) => s.dictOff);
  const jumpTo = useReader((s) => s.jumpTo);
  const { min, max } = w.timeline;
  const x = (year: number) => `${((year - min) / (max - min)) * 100}%`;
  const dicts = w.timeline.dictionaries.filter((d) => !dictOff[d.id]);
  const withArticle = dicts.filter((d) => d.has_article);
  const first = withArticle[0];
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-3 text-[11.5px] text-t2" aria-label={t("legend")}>
        <li className="flex items-center gap-1.5"><span className="dot" style={{ background: "var(--c-root)" }} />{t("lexiconEntryDot")}</li>
        <li className="flex items-center gap-1.5"><span className="inline-block h-[9px] w-[9px] rounded-[2px]" style={{ background: "var(--c-sentence)" }} />{t("corpusDot")}</li>
      </ul>
      <div className="timeline" role="group" aria-label={t("timelineAria", { n: formatNumber(withArticle.length, locale) })}>
        <div className="timeline-track">
          {w.timeline.corpora.map((c) => (
            <span key={c.id} className="timeline-corpus" style={{ insetInlineStart: x(c.year) }} title={`${locale === "ar" ? c.label_ar : c.label_en} · ${c.year}`} />
          ))}
          {dicts.map((d) => (
            <button
              key={d.id}
              type="button"
              className={"timeline-dot" + (d.has_article ? "" : " is-empty")}
              style={{ insetInlineStart: x(d.death_ce) }}
              title={`${locale === "ar" ? d.title_ar : d.title_en} · ${locale === "ar" ? d.author_ar : d.author_en} · ${d.death_ce}`}
              aria-label={`${locale === "ar" ? d.title_ar : d.title_en} ${d.death_ce}`}
              onClick={() => jumpTo("lexica")}
              disabled={!d.has_article}
            />
          ))}
        </div>
        <div className="timeline-axis" aria-hidden="true">
          {TICKS.map((y) => (
            <span key={y} style={{ insetInlineStart: x(y) }}>{formatNumber(y, locale)}</span>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-t2">
        {first
          ? t("timelineSummary", { n: formatNumber(withArticle.length, locale), first: locale === "ar" ? first.title_ar : first.title_en, year: formatNumber(first.death_ce, locale) })
          : t("timelineNone")}
      </p>
      <p className="rounded-lg border border-dashed border-line-2 px-3 py-2 text-[12px] leading-relaxed text-t3">{t("timelineSensesPending")}</p>
    </div>
  );
}
