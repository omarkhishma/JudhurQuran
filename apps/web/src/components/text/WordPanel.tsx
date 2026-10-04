"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { dictHref } from "@/lib/dictionary";
import type { Form } from "@/lib/hadith";
import { usePersonal } from "@/lib/reader/store";

/**
 * A word's reading beside a text beyond the Quran (P11.4a), shared by the hadith and the books: how the rules read it
 * and how sure they are, its root in the Quran and in the dictionary, the Quran's word where the form is the Quran's,
 * the other readings the rules allow. The page that holds it gives it focus when a word is chosen.
 */
function pct(x: number, locale: string) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent", maximumFractionDigits: 0 }).format(x);
}

export function WordPanel({ word, form, onClose, ref, hint }: { word: string | null; form: Form | null; onClose: () => void; ref: React.Ref<HTMLElement>; hint?: string }) {
  const t = useTranslations("hadith");
  const locale = useLocale();
  const first = form?.readings[0];
  // a word looked up in a hadith or a book is the reader's last lookup, as in the Quran (SHL-Q09): the hub's strip
  // and the concordance carry its lemma and its root
  const recordLookup = usePersonal((s) => s.recordLookup);
  const lemma = first?.lemma?.slug ?? null;
  const root = first?.root ?? null;
  useEffect(() => {
    if (word && (lemma || root)) recordLookup({ word: lemma, wordAr: word, root, verse: null });
  }, [word, lemma, root, recordLookup]);
  return (
    <aside ref={ref} tabIndex={-1} className={`hadith-panel${word ? " is-open" : ""}`} aria-label={t("wordTitle")} aria-live="polite">
      {!word ? (
        <p className="text-[13px] text-t3">{hint ?? t("wordHint")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <p className="ar-classical flex-1 text-[30px] leading-tight" lang="ar" dir="rtl">{word}</p>
            <button type="button" className="btn" onClick={onClose}>{t("close")}</button>
          </div>
          {form && (
            <>
              <p className="flex flex-wrap gap-1.5 text-[12.5px]">
                <span className="state-chip">{t(`kind_${form.kind}` as "kind_form")}</span>
                {form.kind !== "particle" && form.kind !== "none" && <span className="state-chip">{t("readingAuto", { c: pct(form.confidence, locale) })}</span>}
              </p>
              {first?.dict_root && (
                <p className="ar-classical text-[34px] leading-none text-root" lang="ar" dir="rtl" aria-label={first.dict_root}>
                  {[...first.dict_root].join(" ")}
                </p>
              )}
              {first?.pattern_ar && <p className="text-[13px] text-t2">{t("pattern", { pattern: first.pattern_ar })}</p>}
              <p className="flex flex-wrap gap-2">
                {first?.root && <Link href={`/roots/${encodeURIComponent(first.root)}`} className="btn">{t("rootInQuran")}</Link>}
                {first?.dict_root && <Link href={dictHref(first.dict_root)} className="btn">{t("rootInDictionary")}</Link>}
                {first?.lemma && <Link href={`/read?w=${encodeURIComponent(first.lemma.slug)}`} className="btn">{t("lemmaInQuran")}</Link>}
              </p>
              {form.readings.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[12.5px] text-t3">{t("otherReadings")}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {form.readings.slice(1, 6).map((r, i) =>
                      r.dict_root ? (
                        <li key={i}>
                          <Link href={dictHref(r.dict_root)} className="state-chip ar-classical" lang="ar">{[...r.dict_root].join(" ")}</Link>
                        </li>
                      ) : null,
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
