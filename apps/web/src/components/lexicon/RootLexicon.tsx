"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { RootLexicon as RootLexiconData } from "@/lib/types";
import { articleHrefOfQuranRoot } from "@/lib/dictionary";
import { formatNumber } from "@/lib/format";
import { LexiconArticle } from "./LexiconArticle";

/** The root page's dictionary section: one tab per work, ordered by the author's death date; each article's identifier
 * leads to it in the dictionary (P1.7a). */
export function RootLexicon({ lexicon, root }: { lexicon: RootLexiconData; root: string }) {
  const t = useTranslations("lexicon");
  const locale = useLocale();
  const [active, setActive] = useState(lexicon.works[0]?.id);
  if (!lexicon.works.length) return <p className="rounded-xl bg-card-2 px-4 py-3 text-t3">{t("noLexicon")}</p>;
  const work = lexicon.works.find((w) => w.id === active) ?? lexicon.works[0];
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap gap-1.5 border-b border-line p-3" role="tablist" aria-label={t("inLexicons")}>
        {lexicon.works.map((w) => (
          <button
            key={w.id}
            type="button"
            role="tab"
            aria-selected={w.id === work.id}
            className={"chip min-h-[36px] " + (w.id === work.id ? "is-on" : "")}
            onClick={() => setActive(w.id)}
          >
            <span className={w.lang === "ar" ? "ar-classical text-[15px]" : "text-[13px]"} lang={w.lang}>
              {locale === "ar" || w.lang === "ar" ? w.title_ar : w.title_en}
            </span>
          </button>
        ))}
      </div>
      <div className="space-y-5 p-4 md:p-5" role="tabpanel">
        <p className="text-[12.5px] text-t3">
          {locale === "ar" ? w(work.author_ar, work.death_hijri, locale) : `${work.author_en}${work.death_ce ? ` (d. ${work.death_ce} CE)` : ""}`}
        </p>
        {work.entries.map((e) => (
          <LexiconArticle key={e.id} work={work} entry={e} href={e.uri ? articleHrefOfQuranRoot(root, e.uri) : undefined} />
        ))}
        <details className="text-[12px] text-t3">
          <summary className="cursor-pointer">{t("edition")}</summary>
          <p className="mt-1 leading-relaxed">{work.edition_note}</p>
          <p className="mt-1 leading-relaxed">{work.license}</p>
        </details>
      </div>
    </div>
  );
}

function w(author: string, death: number | null, locale: string): string {
  return death ? `${author} (ت ${formatNumber(death, locale)}هـ)` : author;
}
