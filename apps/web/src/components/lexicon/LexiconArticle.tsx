"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { LexiconEntrySummary, LexiconWork } from "@/lib/types";
import { toArabicDigits } from "@/lib/format";

/** One dictionary article: excerpt first, full verbatim body on demand, with its citation. */
export function LexiconArticle({ work, entry, compact = false }: { work: LexiconWork; entry: LexiconEntrySummary; compact?: boolean }) {
  const t = useTranslations("lexicon");
  const locale = useLocale();
  const [full, setFull] = useState(false);
  const { data, isFetching } = useQuery({
    queryKey: ["lex-entry", entry.id],
    enabled: full,
    queryFn: async () => (await (await fetch(`/api/v1/lexicon/entries/${entry.id}`)).json()) as { body: string },
  });
  const truncated = entry.length > entry.excerpt.length;
  // Whitespace only: a verse citation the source printed on its own line («[الفجر/ ٣]») rejoins its sentence.
  const raw = full && data ? data.body : entry.excerpt + (truncated ? "…" : "");
  const body = raw.replace(/\n\n(?=\[)/g, " ");
  const isArabic = work.lang === "ar";
  return (
    <article className="space-y-2">
      {entry.confidence === "high" && (
        <p className="rounded-lg border border-amber/40 bg-amber/5 px-2.5 py-1 text-[12px] text-t2">{t("approxMatch")}</p>
      )}
      <div
        className={(isArabic ? "ar-classical text-[17px] leading-[2.05]" : "text-[14.5px] leading-relaxed") + " whitespace-pre-line text-t1"}
        dir={isArabic ? "rtl" : "ltr"}
        lang={isArabic ? "ar" : "en"}
      >
        {body}
      </div>
      {truncated && (
        <button type="button" className="btn" onClick={() => setFull((v) => !v)} aria-expanded={full} disabled={isFetching}>
          {full ? t("showLess") : isFetching ? t("loading") : t("readFull")}
        </button>
      )}
      {!compact && (
        <p className="border-t border-line pt-2 text-[11.5px] leading-relaxed text-t3">
          {t("headword", { h: entry.headword })}
          {entry.page_ref ? ` · ${t("page", { p: locale === "ar" ? toArabicDigits(entry.page_ref) : entry.page_ref })}` : ""}
          {" · "}
          <a href={work.source_url} target="_blank" rel="noreferrer" className="hover:underline">
            {locale === "ar" ? work.attribution_ar : work.attribution_en}
          </a>
          {!work.redistributable && ` · ${t("displayOnly")}`}
        </p>
      )}
    </article>
  );
}
