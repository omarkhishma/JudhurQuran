"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Term } from "@/components/terms/Term";
import { cnt, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { LexicalProfile, Surah, Verse } from "@/lib/types";

const LEVELS = [1, 2, 3, 4, 5] as const;

/** The share of the words that occur 20 times or more in the Quran. */
const common = (p: LexicalProfile) => (p.words ? (p.c100 + p.c20) / p.words : 1);

/**
 * How common a verse's words are in the Quran (P3.6): its lexical level with the measure behind it, the
 * share of its words that occur 20 times or more, and the words found nowhere else. It describes
 * frequency, never judges the verse (law L4, RDR-571).
 */
export function VerseVocabulary({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const v = useQuery({ queryKey: ["verse", verseKey], queryFn: () => getJSON<Verse>(`/verses/${verseKey}`), staleTime: Infinity });
  const p = v.data?.lexical_profile;
  if (!p || !p.words || p.level == null) return null;
  const pct = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent" });
  return (
    <p className="vocab-line text-[12px] leading-relaxed text-t2" data-level={p.level}>
      <span className="vocab-level">{t.rich("vocabLevel", { n: formatNumber(p.level, locale), max: formatNumber(5, locale), term: (c) => <Term id="lexicalLevel">{c}</Term> })}</span>
      {" · "}
      {t("vocabCommon", { pct: pct.format(common(p)) })}
      {p.c1 > 0 && <> · {t("vocabOnce", cnt(p.c1, locale))}</>}
    </p>
  );
}

/** The same for a whole sūra, with how many of its verses fall at each level. */
export function SurahVocabulary({ surah }: { surah: number }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const all = useQuery({ queryKey: ["surahs"], queryFn: () => getJSON<{ data: Surah[] }>("/surahs"), staleTime: Infinity });
  const p = all.data?.data.find((s) => s.number === surah)?.lexical_profile;
  if (!p || !p.words) return null;
  const pct = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent" });
  const levels = p.verse_levels ?? {};
  return (
    <section className="vocab-surah flex flex-col gap-1" aria-label={t("vocabSurahTitle")}>
      <p className="label-caps">{t("vocabSurahTitle")}</p>
      <p className="text-[12.5px] leading-relaxed text-t2">
        {t("vocabCommon", { pct: pct.format(common(p)) })}
        {p.c1 > 0 && <> · {t("vocabOnceSurah", cnt(p.c1, locale))}</>}
      </p>
      <p className="text-[12px] text-t3">
        {t.rich("vocabSurahLevels", { term: (c) => <Term id="lexicalLevel">{c}</Term> })}{" "}
        <span className="vocab-levels">
          {LEVELS.map((l) => t("vocabLevelItem", { ord: t(`lvlOrd_${l}`), n: formatNumber(levels[String(l)] ?? 0, locale) })).join(t("listSep"))}
        </span>
      </p>
    </section>
  );
}
