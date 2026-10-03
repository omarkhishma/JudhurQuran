"use client";

import { useLocale, useTranslations } from "next-intl";
import { useWord, useWordAt } from "@/lib/reader/api";
import { usePrefs } from "@/lib/reader/store";

/**
 * The inline gloss (design 03 §3.4, RDR-605): on a phone with the sheet put away, the selected word's
 * meaning here sits under its verse; a tap brings the sheet back with the full entry.
 */
export function InlineGloss({ slug, at }: { slug: string; at: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const setPrefs = usePrefs((s) => s.set);
  const q = useWord(slug || null, at);
  const byPlace = useWordAt(slug ? null : at);
  if (!slug) {
    // a word with no lemma: its form, what the gharīb works say here, its part of speech, and no root (RDR-137)
    const d = byPlace.data;
    if (!d) return null;
    const f = d.features as unknown as { pos?: { ar: string; en: string } };
    const meaning = d.meanings_here[0] ? `${d.meanings_here[0].phrase_ar}: ${d.meanings_here[0].meaning_ar}` : d.glosses[0]?.gloss;
    return (
      <button type="button" className="inline-gloss" onClick={() => setPrefs({ panelOpen: true })} aria-label={t("openEntry", { w: d.text_uthmani })}>
        <span className="quran text-[21px] leading-[1.6]" lang="ar" dir="rtl">{d.text_uthmani}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-start">
          {meaning ? (
            <span className="truncate text-[13.5px] text-t1" lang="ar" dir="rtl">{meaning}</span>
          ) : d.gloss_en ? (
            <span className="truncate text-[13.5px] text-t1" lang="en" dir="ltr">{d.gloss_en}</span>
          ) : null}
          <span className="truncate text-[11.5px] text-t3">
            {d.translit && <span className="mono" dir="ltr">{d.translit}</span>}
            {f.pos ? ` · ${locale === "ar" ? f.pos.ar : f.pos.en}` : ""} · {t("noRoot")}
          </span>
        </span>
        <span className="inline-gloss-go" aria-hidden="true">‹</span>
      </button>
    );
  }
  const w = q.data;
  if (!w) return null;
  const ar = w.occurrence?.glosses[0]?.gloss;
  const en = w.occurrence?.gloss_en ?? w.gloss_en;
  return (
    <button type="button" className="inline-gloss" onClick={() => setPrefs({ panelOpen: true })} aria-label={t("openEntry", { w: w.ar.full })}>
      <span className="quran text-[21px] leading-[1.6]" lang="ar" dir="rtl">{w.occurrence?.surface.full ?? w.ar.full}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-start">
        {ar ? (
          <span className="truncate text-[13.5px] text-t1" lang="ar" dir="rtl">{ar}</span>
        ) : en ? (
          <span className="truncate text-[13.5px] text-t1" lang="en" dir="ltr">{en}</span>
        ) : null}
        <span className="truncate text-[11.5px] text-t3">
          <span className="mono" dir="ltr">{w.ar.translit}</span> · {locale === "ar" ? w.pos.ar : w.pos.en}
          {w.root ? ` · ${w.root.ar_spaced}` : ""}
        </span>
      </span>
      <span className="inline-gloss-go" aria-hidden="true">‹</span>
    </button>
  );
}
