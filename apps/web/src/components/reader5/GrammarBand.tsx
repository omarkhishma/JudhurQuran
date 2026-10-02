"use client";

import { useLocale } from "next-intl";
import { useWord } from "@/lib/reader/api";
import type { Features, Label } from "@/lib/reader/types";

/**
 * The grammar band (design 03 §3.4, RDR-039/097): under the verse holding the hovered or selected word,
 * that word as written here and its morphology from the corpus — part of speech, form, aspect, voice,
 * person/gender/number, case or mood. A reading aid the reader switches on in Reading preferences.
 */
export function GrammarBand({ slug, at }: { slug: string; at: string }) {
  const locale = useLocale();
  const q = useWord(slug, at);
  const occ = q.data?.occurrence;
  if (!occ || occ.location !== at) return <span className="gram-wait" aria-hidden="true" />;
  return (
    <>
      <span className="quran text-[21px] leading-[1.6] text-t1" lang="ar" dir="rtl">{occ.surface.full}</span>
      <span className="gram-tags" lang={locale === "ar" ? "ar" : "en"}>{tags(occ.features, locale).join(" · ")}</span>
    </>
  );
}

function tags(f: Features, locale: string): string[] {
  const l = (x?: Label) => (x ? (locale === "ar" ? x.ar : x.en) : null);
  const out = [l(f.pos), f.verb_form ? `${f.verb_form.pattern} (${f.verb_form.roman})` : null, l(f.aspect), l(f.voice), l(f.derivation)];
  out.push([l(f.person), l(f.gender), l(f.number)].filter(Boolean).join(" ") || null);
  out.push(l(f.case), l(f.mood));
  return out.filter((x): x is string => !!x);
}
