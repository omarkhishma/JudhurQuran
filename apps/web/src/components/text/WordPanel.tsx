"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { dictHref } from "@/lib/dictionary";
import { cnt } from "@/lib/format";
import { type Form, refText } from "@/lib/hadith";
import { getJSON } from "@/lib/reader/api";
import { usePersonal } from "@/lib/reader/store";
import { type RootHit, hitHref, rootTextsHref } from "@/lib/rootlife";

/**
 * A word's reading beside a text beyond the Quran (P11.4a), shared by the hadith and the books: how the rules read it
 * and how sure they are, its root in the Quran and in the dictionary, the Quran's word where the form is the Quran's,
 * the other readings the rules allow. The page that holds it gives it focus when a word is chosen.
 */
function pct(x: number, locale: string) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent", maximumFractionDigits: 0 }).format(x);
}

export function WordPanel({
  word,
  form,
  onClose,
  ref,
  hint,
  place,
  text,
  children,
}: {
  word: string | null;
  form: Form | null;
  onClose: () => void;
  ref: React.Ref<HTMLElement>;
  hint?: string;
  /** the hadith or the book paragraph the word is read in (SHL-Q09): the hub's strip leads back to it */
  place?: { href: string; label: string } | null;
  /** what the page adds for this word: the Analyser, for a word of the reader's text read by a rule; the word's places
   * in the reader's text */
  children?: React.ReactNode;
  /** the hadith collection or the book the word is read in (its slug): the word's places in it (P1.3 ?in_text=) */
  text?: string;
}) {
  const t = useTranslations("hadith");
  const locale = useLocale();
  const first = form?.readings[0];
  // a word looked up in a hadith or a book is the reader's last lookup, as in the Quran (SHL-Q09): the hub's strip
  // and the concordance carry its lemma and its root
  const recordLookup = usePersonal((s) => s.recordLookup);
  const lemma = first?.lemma?.slug ?? null;
  const root = first?.root ?? null;
  const placeHref = place?.href ?? null;
  const placeLabel = place?.label ?? null;
  useEffect(() => {
    if (word && (lemma || root)) recordLookup({ word: lemma, wordAr: word, root, verse: null, place: placeHref && placeLabel ? { href: placeHref, label: placeLabel } : null });
  }, [word, lemma, root, recordLookup, placeHref, placeLabel]);
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
              {children}
              {text && first?.lemma && <InThisText text={text} slug={first.lemma.slug} dictRoot={first.dict_root ?? null} />}
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

type InText = { lemma: { slug: string; ar: string }; text: { slug: string; kind: string; title_ar: string; title_en: string }; total: number; data: RootHit[]; siblings: RootHit[] };

/** A Quranic word in the collection or the book it is read in (P1.3 ?in_text=, the panel's "In this text", RDR-268…271):
 * how many places the rules surely read it in there, the first of them with the word in its line; where the text has
 * none, its places in the texts that hold it. */
function InThisText({ text, slug, dictRoot }: { text: string; slug: string; dictRoot: string | null }) {
  const t = useTranslations("hadith");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["in-text", text, slug], queryFn: () => getJSON<InText>(`/texts/${text}/words/${encodeURIComponent(slug)}?limit=3`), staleTime: Infinity });
  if (q.isError) return null;
  if (!q.data) return <div className="h-12 animate-pulse rounded-lg bg-card-2" />;
  const d = q.data;
  const title = locale === "ar" ? d.text.title_ar : d.text.title_en;
  const rows = d.total ? d.data : d.siblings;
  const where = (h: RootHit) => (h.text.kind === "hadith" ? t("inTextHadith", { book: locale === "ar" ? h.text.title_ar : h.text.title_en, ref: refText(h.ref, locale) }) : locale === "ar" ? h.text.title_ar : h.text.title_en);
  return (
    <section className="flex flex-col gap-1.5 border-t border-line pt-3" aria-label={t("inTextTitle")} data-testid="in-this-text">
      <p className="text-[13px] font-medium">{t("inTextTitle")}</p>
      <p className="text-[12.5px] text-t2">{d.total ? t("inTextCount", { ...cnt(d.total, locale), ar: d.lemma.ar, title }) : t("inTextNone", { ar: d.lemma.ar, title })}</p>
      {rows.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rows.map((h) => (
            <li key={h.uri}>
              <Link href={hitHref(h)} className="flex flex-col gap-0.5 rounded-md px-1.5 py-1 hover:bg-card-2">
                {h.kwic && (
                  <span className="ar-classical text-[15px] leading-[1.8]" lang="ar" dir="rtl">
                    <span className="text-t2">{h.kwic.before}</span>
                    <mark className="kwic-word">{h.kwic.word}</mark>
                    <span className="text-t2">{h.kwic.after}</span>
                  </span>
                )}
                <span className="text-[11px] text-t3">
                  <bdi>{where(h)}</bdi>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {d.total > d.data.length && dictRoot && (
        <Link href={rootTextsHref(dictRoot, { text: d.text.slug })} className="text-[12px] text-ring hover:underline">
          {t("inTextRoot")}
        </Link>
      )}
    </section>
  );
}
