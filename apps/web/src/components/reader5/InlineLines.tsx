"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { getJSON } from "@/lib/reader/api";
import { usePrefs } from "@/lib/reader/store";
import { useWorkSurah } from "@/lib/reader/useWorkSurah";

function useLines(chapter: number, kind: "imlaei" | "translit", enabled: boolean) {
  return useQuery({
    queryKey: ["surah-lines", chapter, kind],
    queryFn: () => getJSON<{ data: Record<string, string> }>(`/surahs/${chapter}/lines?kind=${kind}`),
    enabled,
    staleTime: Infinity,
  });
}

/**
 * The optional lines under each verse, each fetched only when it is on and portalled into its verse's
 * slot (P2.10a keeps them out of the page): the standard spelling (D7), the transliteration, al-Muyassar's
 * plain Arabic explanation (Arabic UI option) and a translation (on by default in English) — RDR-095/096,
 * RDR-557.
 */
export function InlineLines({ chapter }: { chapter: number }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const pref = usePrefs((s) => s.translationLine);
  const translation = usePrefs((s) => s.translation);
  const muyassar = usePrefs((s) => s.muyassarLine);
  const imlaeiOn = usePrefs((s) => s.imlaeiLine);
  const translitPref = usePrefs((s) => s.translitLine);
  const translationOn = pref ?? locale !== "ar";
  const translitOn = translitPref ?? locale !== "ar";
  const tr = useWorkSurah(translation, chapter, translationOn);
  const tf = useWorkSurah("muyassar", chapter, muyassar);
  const iml = useLines(chapter, "imlaei", imlaeiOn);
  const tl = useLines(chapter, "translit", translitOn);
  // Rendered only after mount (ReadingSurface), so the server-rendered slots are already in the DOM.
  const slots = useMemo(() => (chapter ? Array.from(document.querySelectorAll<HTMLElement>("[data-inline]")) : []), [chapter]);
  if (!translationOn && !muyassar && !imlaeiOn && !translitOn) return null;
  const byAyah = (data: typeof tr.data) => {
    const m = new Map<number, string>();
    for (const p of data?.passages ?? []) if (p.from_surah === chapter) for (let a = p.from_ayah; a <= (p.to_surah === chapter ? p.to_ayah : p.from_ayah); a++) m.set(a, p.text);
    return m;
  };
  const trMap = byAyah(tr.data);
  const tfMap = byAyah(tf.data);
  return (
    <>
      {slots.map((slot) => {
        const ayah = (slot.dataset.inline ?? "").split(":")[1];
        const trText = translationOn ? trMap.get(Number(ayah)) : undefined;
        const tfText = muyassar ? tfMap.get(Number(ayah)) : undefined;
        const imText = imlaeiOn ? iml.data?.data[ayah] : undefined;
        const tlText = translitOn ? tl.data?.data[ayah] : undefined;
        if (!trText && !tfText && !imText && !tlText) return null;
        return createPortal(
          <div className="inline-lines">
            {imText && (
              <p className="verse-imlaei" dir="rtl" lang="ar">
                <span className="verse-imlaei-label">{t("imlaeiLabel")}</span> {imText}
              </p>
            )}
            {tlText && <p className="verse-translit" dir="ltr" lang="en">{tlText}</p>}
            {tfText && <p className="inline-muyassar" dir="rtl" lang="ar">{tfText}</p>}
            {trText && (
              <p className="inline-translation" dir="ltr" lang="en" data-credit={tr.data ? `${tr.data.work.title_en} (${tr.data.work.author_en})` : undefined}>
                <span className="inline-tr-text">{trText}</span>
                {tr.data && <span className="inline-credit">{` — ${tr.data.work.title_en}`}</span>}
              </p>
            )}
          </div>,
          slot,
          slot.dataset.inline,
        );
      })}
    </>
  );
}
