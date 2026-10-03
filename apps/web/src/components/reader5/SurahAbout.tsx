"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { EditorNote, SurahCard } from "@/lib/reader/types";
import type { ChapterInfo } from "./ReaderShell";
import { EditorNotes, Fold, SourceCredit, VerseLayer } from "./VerseKnowledge";
import { SurahVocabulary } from "./Vocabulary";

const FIELDS = [
  ["names", "cardNames"],
  ["revelation", "cardRevelation"],
  ["virtues", "cardVirtues"],
  ["count_text_a", "cardCounts"],
  ["count_text_b", "cardCountsB"],
  ["aims", "cardAims"],
] as const;

/**
 * About this sūra (P3.9 sūra cards): the Tafsir Center's study of its names, revelation, virtues,
 * verse counts and aims, verbatim with the editors' notes kept apart; Tanzil's classification and
 * order beside the Center's, and the Center's own conclusion where it differs.
 */
export function SurahAbout({ chapter }: { chapter: ChapterInfo }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["surah-card", chapter.number], queryFn: () => getJSON<SurahCard>(`/surahs/${chapter.number}/card`), staleTime: Infinity });
  if (q.isError) return <p className="p-4 text-[13px] text-bad">{t("loadFailed")}</p>;
  if (!q.data) return <div className="m-4 h-40 animate-pulse rounded-xl bg-card-2" role="status" aria-label={t("loading")} />;
  const c = q.data.card;
  const truncated = new Set(c.truncated_fields ?? []);
  return (
    <article className="flex flex-col gap-2 p-3.5" aria-label={t("aboutSurah")}>
      <header className="flex flex-col gap-1 pb-1">
        <h2 className="ar-classical text-[24px] leading-[1.5]" lang="ar">{`سورة ${chapter.nameAr}`}</h2>
        <p className="text-[12.5px] text-t2">
          {t("cardPlaceOrder", {
            place: c.place === "meccan" ? t("meccan") : t("medinan"),
            order: formatNumber(c.revelation_order, locale),
          })}
          {!c.place_agrees || !c.order_agrees ? (
            <span className="text-t3"> • {t("cardTcDiffers", { place: c.tc_place_ar, order: formatNumber(c.tc_revelation_order, locale) })}</span>
          ) : null}
        </p>
        {c.tc_study_preferred_period && (
          <p className="text-[12px] text-t3">{t("cardStudyPrefers", { period: t(`period_${c.tc_study_preferred_period}`) })}</p>
        )}
      </header>
      <SurahVocabulary surah={chapter.number} />
      {FIELDS.map(([field, label]) => {
        const text = c[field];
        if (!text) return null;
        const notes = c[`${field}_notes` as const] as EditorNote[] | null;
        return (
          <VerseLayer key={field} title={t(label)} defaultOpen={field === "names" || field === "aims"}>
            <Fold text={text.trim()} lines={8} className="ar-classical whitespace-pre-line text-[15px] leading-[2] text-t1" />
            {truncated.has(field) && <p className="text-[11px] text-amber">{t("cardTruncated")}</p>}
            <EditorNotes notes={notes} />
          </VerseLayer>
        );
      })}
      {q.data.card.source_ids.map((id) => (
        <SourceCredit key={id} s={q.data.sources[id]} />
      ))}
      <p className="text-[11px] text-t3">{t("extractedNote")}</p>
    </article>
  );
}
