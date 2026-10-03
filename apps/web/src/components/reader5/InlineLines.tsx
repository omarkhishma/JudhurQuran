"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { usePrefs } from "@/lib/reader/store";
import { useWorkSurah } from "@/lib/reader/useWorkSurah";

/** The lines under each verse (RDR-095/096, RDR-557): a translation (on by default in English) and,
 * in Arabic, al-Muyassar's plain explanation as an option — each portalled into its verse's slot. */
export function InlineLines({ chapter }: { chapter: number }) {
  const locale = useLocale();
  const pref = usePrefs((s) => s.translationLine);
  const translation = usePrefs((s) => s.translation);
  const muyassar = usePrefs((s) => s.muyassarLine);
  const translationOn = pref ?? locale !== "ar";
  const tr = useWorkSurah(translation, chapter, translationOn);
  const tf = useWorkSurah("muyassar", chapter, muyassar);
  // Rendered only after mount (ReadingSurface), so the server-rendered slots are already in the DOM.
  const slots = useMemo(() => (chapter ? Array.from(document.querySelectorAll<HTMLElement>("[data-inline]")) : []), [chapter]);
  if (!translationOn && !muyassar) return null;
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
        const ayah = Number((slot.dataset.inline ?? "").split(":")[1]);
        const trText = translationOn ? trMap.get(ayah) : undefined;
        const tfText = muyassar ? tfMap.get(ayah) : undefined;
        if (!trText && !tfText) return null;
        return createPortal(
          <div className="inline-lines">
            {tfText && <p className="inline-muyassar" dir="rtl" lang="ar">{tfText}</p>}
            {trText && (
              <p className="inline-translation" dir="ltr" lang="en" data-credit={tr.data ? `${tr.data.work.title_en} (${tr.data.work.author_en})` : undefined}>
                {trText}
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
