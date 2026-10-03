"use client";

import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { Term } from "@/components/terms/Term";
import { useWord, useWordAt } from "@/lib/reader/api";
import type { Features, Label } from "@/lib/reader/types";
import { FORM_TERM, TAG_TERM, type TermId } from "@/lib/terms";

/**
 * The grammar band (design 03 §3.4, RDR-039/097): under the verse holding the hovered or selected word,
 * that word as written here and its morphology from the corpus — part of speech, form, aspect, voice,
 * person/gender/number, case or mood. A reading aid the reader switches on in Reading preferences.
 */
export function GrammarBand({ slug, at }: { slug: string; at: string }) {
  const locale = useLocale();
  const q = useWord(slug || null, at);
  // a word with no lemma (a free pronoun, the Quranic initials) is read by its place (RDR-136)
  const byPlace = useWordAt(slug ? null : at);
  if (!slug) {
    const w = byPlace.data;
    if (!w) return <span className="gram-wait" aria-hidden="true" />;
    return (
      <>
        <span className="quran text-[21px] leading-[1.6] text-t1" lang="ar" dir="rtl">{w.text_uthmani}</span>
        <span className="gram-tags" lang={locale === "ar" ? "ar" : "en"}>{termTags(w.features as unknown as Features, locale)}</span>
      </>
    );
  }
  const occ = q.data?.occurrence;
  if (!occ || occ.location !== at) return <span className="gram-wait" aria-hidden="true" />;
  return (
    <>
      <span className="quran text-[21px] leading-[1.6] text-t1" lang="ar" dir="rtl">{occ.surface.full}</span>
      <span className="gram-tags" lang={locale === "ar" ? "ar" : "en"}>{termTags(occ.features, locale)}</span>
    </>
  );
}

const POS_TERM: Record<string, TermId> = { PRON: "pronoun", ADJ: "adjective", P: "particle", CONJ: "particle", NEG: "particle", INL: "muqattaat" };

/** The same labels as `tags`, each wrapped in its dotted term where the glossary has one. */
export function termTags(f: Features, locale: string): ReactNode[] {
  const l = (x?: Label) => (x ? (locale === "ar" ? x.ar : x.en) : null);
  const term = (x: Label | undefined, id: TermId | undefined) => (x && id ? <Term key={x.tag} id={id}>{l(x)}</Term> : l(x));
  const out: ReactNode[] = [
    term(f.pos, f.pos ? POS_TERM[f.pos.tag] : undefined),
    f.verb_form ? (FORM_TERM[f.verb_form.number] ? <Term key="vf" id={FORM_TERM[f.verb_form.number]!}>{`${f.verb_form.pattern} (${f.verb_form.roman})`}</Term> : `${f.verb_form.pattern} (${f.verb_form.roman})`) : null,
    term(f.aspect, f.aspect ? TAG_TERM[f.aspect.tag] : undefined),
    term(f.voice, f.voice ? TAG_TERM[f.voice.tag] : undefined),
    term(f.derivation, f.derivation ? TAG_TERM[f.derivation.tag] : undefined),
    [l(f.person), l(f.gender), l(f.number)].filter(Boolean).join(" ") || null,
    term(f.case, f.case ? TAG_TERM[f.case.tag] : undefined),
    term(f.mood, f.mood ? TAG_TERM[f.mood.tag] : undefined),
  ];
  return out.filter((x) => x != null && x !== "").flatMap((x, i) => (i ? [" • ", x] : [x]));
}

export function tags(f: Features, locale: string): string[] {
  const l = (x?: Label) => (x ? (locale === "ar" ? x.ar : x.en) : null);
  const out = [l(f.pos), f.verb_form ? `${f.verb_form.pattern} (${f.verb_form.roman})` : null, l(f.aspect), l(f.voice), l(f.derivation)];
  out.push([l(f.person), l(f.gender), l(f.number)].filter(Boolean).join(" ") || null);
  out.push(l(f.case), l(f.mood));
  return out.filter((x): x is string => !!x);
}
