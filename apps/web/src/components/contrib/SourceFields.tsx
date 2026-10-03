"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { Source } from "@/lib/contrib";
import { getJSON } from "@/lib/reader/api";

/** A proposal's sources while they are written: each lexicon with its own entry or page, a verse, a grammar's place,
 * and any other source kept as it came. */
export type SourceDraft = { lexicons: Record<string, string>; verse: string; grammar: string; other: Source[] };

const VERSE = /^\d{1,3}:\d{1,3}$/;
/** a verse typed on an Arabic keyboard is the same verse (DECISIONS; audit 12 F18) */
const ascii = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\s+/g, "");
export const verseOk = (v: string) => !v.trim() || VERSE.test(ascii(v.trim()));

export const emptyDraft = (): SourceDraft => ({ lexicons: {}, verse: "", grammar: "", other: [] });

export function fromSources(sources: Source[]): SourceDraft {
  const d = emptyDraft();
  for (const s of sources) {
    if (s.work === "quran" && !d.verse) d.verse = s.ref;
    else if (s.work === "grammar" && !d.grammar) d.grammar = s.ref;
    else if (s.work === "other" || s.work === "quran" || s.work === "grammar") d.other.push({ work: s.work, ref: s.ref });
    else d.lexicons[s.work] = s.ref;
  }
  return d;
}

export function toSources(d: SourceDraft): Source[] {
  return [
    ...Object.entries(d.lexicons).map(([work, ref]) => ({ work, ref: ref.trim() })),
    ...(d.verse.trim() && verseOk(d.verse) ? [{ work: "quran", ref: ascii(d.verse.trim()) }] : []),
    ...(d.grammar.trim() ? [{ work: "grammar", ref: d.grammar.trim() }] : []),
    ...d.other,
  ];
}

/** What a reviewer can check: a lexicon with its entry or page, a verse, a grammar with its place (RVQ-Q05, F9). */
export const checkable = (sources: Source[]) => sources.some((s) => s.work === "quran" || (s.work !== "other" && !!s.ref));

/**
 * The structured sources of a proposal (RVQ-Q05), the same in the proposal form and the revise form (audit 12 F3):
 * the lexicons, each with its own entry or page (F9), an attesting verse in either digits with a word when it is
 * not one (F18), a grammar's reference; the warning when a wording of meaning has nothing a reviewer can check.
 */
export function SourceFields({ draft, onChange, needsSource }: { draft: SourceDraft; onChange: (d: SourceDraft) => void; needsSource: boolean }) {
  const t = useTranslations("rd");
  const tc = useTranslations("contrib");
  const locale = useLocale();
  const dicts = useQuery({ queryKey: ["dictionaries"], queryFn: () => getJSON<{ data: { key: string; name_ar: string; name_en: string }[] }>("/dictionaries"), staleTime: Infinity });
  const list = dicts.data?.data ?? [];
  const name = (k: string) => {
    const d = list.find((x) => x.key === k);
    return d ? (locale === "ar" ? d.name_ar : d.name_en) : k;
  };
  const toggle = (k: string) => {
    const lexicons = { ...draft.lexicons };
    if (k in lexicons) delete lexicons[k];
    else lexicons[k] = "";
    onChange({ ...draft, lexicons });
  };
  const badVerse = !verseOk(draft.verse);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label-caps">{t("sources")}</legend>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={tc("lexicons")}>
        {list.map((d) => (
          <button key={d.key} type="button" className={"chip" + (d.key in draft.lexicons ? " is-on" : "")} aria-pressed={d.key in draft.lexicons} onClick={() => toggle(d.key)}>
            {locale === "ar" ? d.name_ar : d.name_en}
          </button>
        ))}
      </div>
      {Object.entries(draft.lexicons).map(([k, ref]) => (
        <input
          key={k}
          value={ref}
          onChange={(e) => onChange({ ...draft, lexicons: { ...draft.lexicons, [k]: e.target.value } })}
          placeholder={tc("refPlaceholder")}
          aria-label={tc("refIn", { work: name(k) })}
          className="field min-h-[40px]"
          dir="auto"
        />
      ))}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <input value={draft.verse} onChange={(e) => onChange({ ...draft, verse: e.target.value })} placeholder={tc("versePlaceholder")} aria-label={tc("verse")} className="field min-h-[40px]" dir="ltr" inputMode="numeric" aria-invalid={badVerse} aria-describedby={badVerse ? "verse-bad" : undefined} />
          {badVerse && (
            <p id="verse-bad" className="text-[11.5px] text-bad">
              {tc("err.quran_ref")}
            </p>
          )}
        </div>
        <input value={draft.grammar} onChange={(e) => onChange({ ...draft, grammar: e.target.value })} placeholder={tc("grammarPlaceholder")} aria-label={tc("grammar")} className="field min-h-[40px]" dir="auto" />
      </div>
      {needsSource && !checkable(toSources(draft)) && <p className="text-[11.5px] text-amber">{tc("needsSource")}</p>}
    </fieldset>
  );
}
