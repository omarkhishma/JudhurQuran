"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { LexiconArticle } from "@/components/lexicon/LexiconArticle";
import { MarksToggle } from "@/components/ui/MarksToggle";
import { Link } from "@/i18n/navigation";
import { dictHref, type DictArticle, type DictRoot } from "@/lib/dictionary";
import { formatNumber } from "@/lib/format";

/** A root's articles in every lexicon (P11.1): one tab per lexicon, in the order their authors died; each article
 * read whole on demand, and said how it reached this root when the lexicographer wrote its heading otherwise. */
export function DictionaryLexicon({ root }: { root: DictRoot }) {
  const t = useTranslations("dictionary");
  const locale = useLocale();
  const [active, setActive] = useState(root.works[0]?.id);
  if (!root.works.length) return null;
  const work = root.works.find((w) => w.id === active) ?? root.works[0];
  const display = (key: string) => root.candidates.find((c) => c.key === key);
  const note = (a: DictArticle) => {
    if (a.rule === "ambiguous" || a.rule === "unresolved") {
      const known = (a.candidates ?? []).map(display).filter((c): c is NonNullable<typeof c> => !!c);
      return (
        <>
          {t("unsureNote", { headword: a.headword })}
          {known.length > 0 && (
            <>
              {" "}
              {t("mayBe")}{" "}
              {known.map((c, i) => (
                <span key={c.key}>
                  {i > 0 && t("or")}
                  <Link href={dictHref(c.key)} className="ar-classical text-[15px] underline underline-offset-2" lang="ar">
                    {c.display}
                  </Link>
                </span>
              ))}
            </>
          )}
        </>
      );
    }
    if (a.rule === "alif-weak" || a.rule === "alif-hamza" || a.rule === "two-letter-doubled" || a.rule === "two-letter-weak") return t("ruleNote", { headword: a.headword, root: root.display });
    return undefined;
  };
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap gap-1.5 border-b border-line p-3" role="tablist" aria-label={t("inLexicons")}>
        {root.works.map((w) => (
          <button key={w.id} type="button" role="tab" aria-selected={w.id === work.id} className={"chip min-h-[36px] " + (w.id === work.id ? "is-on" : "")} onClick={() => setActive(w.id)}>
            <span className={w.lang === "ar" ? "ar-classical text-[15px]" : "text-[13px]"} lang={w.lang}>
              {locale === "ar" || w.lang === "ar" ? w.title_ar : w.title_en}
            </span>
          </button>
        ))}
      </div>
      <div className="space-y-5 p-4 md:p-5" role="tabpanel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] text-t3">
            {locale === "ar" ? (work.death_hijri ? `${work.author_ar} (ت ${formatNumber(work.death_hijri, locale)}هـ)` : work.author_ar) : `${work.author_en}${work.death_ce ? ` (d. ${work.death_ce} CE)` : ""}`}
          </p>
          {/* the articles' vowel marks shown or hidden (D7) */}
          <MarksToggle />
        </div>
        {work.articles.map((a) => (
          <LexiconArticle
            key={a.id}
            work={work}
            entry={{ id: a.id, headword: a.headword, match: null, confidence: "exact", core_meaning: null, page_ref: a.page_ref, excerpt: a.excerpt, length: a.length }}
            entryUrl={`/api/v1/dictionary/entries/${a.id}`}
            note={note(a)}
          />
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
