"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { getOverview, type Kind, type Overview, type Worklists } from "@/lib/editorial";
import { cnt, formatNumber, verseRef } from "@/lib/format";

const pct = (x: number, locale: string) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent", maximumFractionDigits: 1 }).format(x);

/**
 * The administration's dashboard (P14.4): how much of the Quran has its context set — the words with a context by
 * their sūra's passage or a range of their own, the sūras divided into passages — and how many words carry near,
 * related or opposite words; the 114 sūras shaded by the share of their words with a context (one hue, light to dark,
 * the numbers also a table); the tools; and the latest work on the board's entries.
 */
export function Dashboard({ lists, onOpen }: { lists?: Worklists; onOpen: (kind: Kind, target?: string, q?: string) => void }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const ov = useQuery({ queryKey: ["editorial-overview"], queryFn: getOverview, refetchOnWindowFocus: true });
  const [surah, setSurah] = useState("1");
  const [place, setPlace] = useState("");
  if (ov.isPending) return <span className="block h-64 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!ov.data) return <p role="alert" className="text-[13px] text-t2">{t("loadFailed")}</p>;
  const d = ov.data;
  const name = (s: Overview["by_surah"][number]) => (locale === "ar" ? s.name_ar : s.name_translit);

  return (
    <section className="flex flex-col gap-5" aria-labelledby="dash-h">
      <header className="flex flex-col gap-1">
        <h2 id="dash-h" className="text-[20px] font-semibold">{t("dashTitle")}</h2>
        <p className="text-[12.5px] leading-relaxed text-t3">{t("dashLead")}</p>
      </header>

      <div className="dash-kpis">
        <Tile label={t("dashWordsWithContext")} value={formatNumber(d.words_with_context, locale)} sub={t("dashOfWords", { n: formatNumber(d.words, locale), pct: pct(d.words ? d.words_with_context / d.words : 0, locale) })} />
        <Tile label={t("dashSurahsSegmented")} value={formatNumber(d.surahs_with_passages, locale)} sub={t("dashOfSurahs", { n: formatNumber(114, locale) })} />
        <Tile label={t("dashOwnRanges")} value={formatNumber(d.words_own_range, locale)} sub={t("dashOwnRangesSub")} />
        <Tile label={t("dashRelations")} value={formatNumber(d.relations.words, locale)} sub={t("dashLinks", cnt(d.relations.links, locale))} />
        <Tile label={t("awaitingMe")} value={formatNumber(lists?.awaiting_me ?? 0, locale)} sub={t("dashMyOpen", cnt(lists?.my_open ?? 0, locale))} />
      </div>

      <section className="workbench-box" aria-labelledby="dash-cov-h">
        <h3 id="dash-cov-h" className="text-[14px] font-semibold">{t("dashCoverage")}</h3>
        <p className="text-[12px] text-t3">{t("dashCoverageLead")}</p>
        <ol className="topic-coverage" aria-label={t("dashCoverage")}>
          {d.by_surah.map((s) => {
            const share = s.words ? s.words_with_context / s.words : 0;
            const label = t("dashCell", { name: name(s), n: formatNumber(s.surah, locale), words: formatNumber(s.words_with_context, locale), of: formatNumber(s.words, locale), pct: pct(share, locale) });
            return (
              <li key={s.surah}>
                <button type="button" className="topic-cell" style={{ background: `color-mix(in srgb, var(--c-sentence) ${Math.round(share * 100)}%, var(--card))` }} title={label} aria-label={label} onClick={() => onOpen("context_passages", String(s.surah))} />
              </li>
            );
          })}
        </ol>
        <p className="flex items-center gap-2 text-[11px] text-t3" aria-hidden="true">
          <span>{t("coverageNoneCtx")}</span>
          <span className="topic-coverage-ramp ctx-ramp" />
          <span>{t("coverageAllCtx")}</span>
        </p>
        <details className="text-[12px]">
          <summary className="cursor-pointer text-t2">{t("coverageTableCtx")}</summary>
          <table className="mt-2 w-full text-[12px]">
            <thead>
              <tr className="text-t3">
                <th scope="col" className="text-start font-medium">{t("thSurah")}</th>
                <th scope="col" className="text-end font-medium">{t("thVerses")}</th>
                <th scope="col" className="text-end font-medium">{t("thInPassages")}</th>
                <th scope="col" className="text-end font-medium">{t("thWords")}</th>
                <th scope="col" className="text-end font-medium">{t("thWithContext")}</th>
              </tr>
            </thead>
            <tbody>
              {d.by_surah.map((s) => (
                <tr key={s.surah} className="border-t border-line">
                  <th scope="row" className="text-start font-normal">{`${formatNumber(s.surah, locale)}. ${name(s)}`}</th>
                  <td className="text-end">{formatNumber(s.verses, locale)}</td>
                  <td className="text-end">{formatNumber(s.verses_in_passages, locale)}</td>
                  <td className="text-end">{formatNumber(s.words, locale)}</td>
                  <td className="text-end">{formatNumber(s.words_with_context, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <div className="dash-tools">
        <section className="workbench-box" aria-labelledby="tool-seg-h">
          <h3 id="tool-seg-h" className="text-[14px] font-semibold">{t("kind_context_passages")}</h3>
          <p className="text-[12px] leading-relaxed text-t3">{t("dashToolSegment")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <select className="field-input" value={surah} onChange={(e) => setSurah(e.target.value)} aria-label={t("thSurah")}>
              {d.by_surah.map((s) => (
                <option key={s.surah} value={s.surah}>{`${formatNumber(s.surah, locale)}. ${name(s)}`}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={() => onOpen("context_passages", surah)}>{t("dashOpen")}</button>
          </div>
        </section>
        <section className="workbench-box" aria-labelledby="tool-word-h">
          <h3 id="tool-word-h" className="text-[14px] font-semibold">{t("kind_context_word")}</h3>
          <p className="text-[12px] leading-relaxed text-t3">{t("dashToolWord")}</p>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const q = place.trim().replace(/[٠-٩]/g, (x) => String(x.charCodeAt(0) - 0x660));
              if (/^\d{1,3}:\d{1,3}:\d{1,3}$/.test(q)) onOpen("context_word", q);
              else onOpen("context_word", undefined, q);
            }}
          >
            <input className="field-input w-40" value={place} onChange={(e) => setPlace(e.target.value)} placeholder={verseRef("2:255:3", locale)} aria-label={t("dashWordPlace")} dir="ltr" />
            <button type="submit" className="btn btn-primary">{t("dashOpen")}</button>
          </form>
        </section>
        <section className="workbench-box" aria-labelledby="tool-rel-h">
          <h3 id="tool-rel-h" className="text-[14px] font-semibold">{t("kind_word_relations")}</h3>
          <p className="text-[12px] leading-relaxed text-t3">{t("dashToolRelations")}</p>
          <button type="button" className="btn btn-primary self-start" onClick={() => onOpen("word_relations")}>{t("dashOpenList")}</button>
        </section>
      </div>

      <section aria-labelledby="dash-recent-h" className="flex flex-col gap-2">
        <h3 id="dash-recent-h" className="text-[14px] font-semibold">{t("dashRecent")}</h3>
        {d.recent.length === 0 ? (
          <p className="text-[12.5px] text-t3">{t("dashRecentNone")}</p>
        ) : (
          <ul className="workbench-rows">
            {d.recent.map((r, i) => (
              <li key={i}>
                <button type="button" className="workbench-row" onClick={() => onOpen(r.kind, r.target)}>
                  <span className="text-[12px] text-t3">{t(r.kind === "verdict" ? `layer_${r.target.split(":")[0]}` : `kind_${r.kind}`)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-t1" dir="auto">{r.kind === "verdict" ? r.target.split(":").slice(1).join(":") : r.target}</span>
                  <span className="text-[12px] text-t3">{t(`action_${r.action}`, { name: r.by ?? t("anEditor"), n: formatNumber(r.revision, locale) })}</span>
                  <span className="text-[11.5px] text-t3">{new Date(r.at).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

/** A headline number: its label, the value, and what it is out of. */
function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="dash-tile">
      <span className="text-[12px] text-t2">{label}</span>
      <span className="text-[26px] font-semibold leading-tight text-t1">{value}</span>
      <span className="text-[11.5px] text-t3">{sub}</span>
    </div>
  );
}
