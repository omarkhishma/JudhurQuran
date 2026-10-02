"use client";

import { useMemo } from "react";
import { usePrefs } from "@/lib/store/reader";
import { useWorkSurah } from "./useWorkSurah";

/** Optional text under a verse: an English translation and/or al-Muyassar, per the reading preferences. */
export function InlineLayer({
  verseKey,
  ayah,
  initial,
  locale,
  title,
}: {
  verseKey: string;
  ayah: number;
  initial: { text: string; footnotes: string | null } | null;
  locale: string;
  title?: string;
}) {
  const surah = Number(verseKey.split(":")[0]);
  const showTranslationPref = usePrefs((s) => s.showTranslation);
  const translation = usePrefs((s) => s.translation);
  const inlineTafsir = usePrefs((s) => s.inlineTafsir);
  const showTranslation = showTranslationPref ?? locale === "en";
  const useInitial = showTranslation && initial && translation === "saheeh";
  const tr = useWorkSurah(translation, surah, showTranslation && !useInitial);
  const tf = useWorkSurah("muyassar", surah, inlineTafsir);

  const trText = useMemo(() => {
    if (useInitial) return initial!.text;
    return tr.data?.passages.find((p) => p.from_surah === surah && p.from_ayah === ayah)?.text ?? null;
  }, [useInitial, initial, tr.data, surah, ayah]);
  const tfText = useMemo(
    () => tf.data?.passages.find((p) => p.from_surah === surah && p.from_ayah === ayah)?.text ?? null,
    [tf.data, surah, ayah],
  );

  if (!(showTranslation && trText) && !(inlineTafsir && tfText)) return null;
  return (
    <div className="inline-layer">
      {inlineTafsir && tfText && (
        <p className="inline-tafsir" dir="rtl" lang="ar">
          {tfText}
        </p>
      )}
      {showTranslation && trText && (
        <p className="inline-translation" dir="ltr" lang="en" title={title}>
          {trText}
        </p>
      )}
    </div>
  );
}
