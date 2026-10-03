"use client";

import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/Icon";
import { useAudio } from "@/lib/store/audio";
import type { WordAudio } from "@/lib/types";

/** The word as recited at this place: its slice of al-Ḥuṣarī's teaching recitation, boundaries refined
 * against the audio (D10) — never synthesised speech for the Quran. No timing, no button. */
export function ListenOccurrence({ verseKey, audio }: { verseKey: string; audio: WordAudio | null }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const playSlice = useAudio((s) => s.playSlice);
  if (!audio) return null;
  const label = t("hearItBy", { reciter: locale === "ar" ? audio.name_ar : audio.name_en });
  return (
    <button type="button" className="listen-btn" onClick={() => playSlice(verseKey, audio)} aria-label={label} title={`${label} — ${t("audioCut")}`}>
      <Icon name="play" size={14} />
    </button>
  );
}

/** What keeps this slice from being a clean word, said plainly (D10: QA flags). Nothing when it is clean. */
export function WordAudioNote({ audio }: { audio: WordAudio | null }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  if (!audio || audio.flags.length === 0) return null;
  return (
    <p className="audio-note text-[11.5px] leading-relaxed text-t3" data-flags={audio.flags.join(" ")}>
      {t("audioNoteLead", { reciter: locale === "ar" ? audio.name_ar : audio.name_en })} {audio.flags.map((f) => t(`audioFlag_${f}`)).join(" ")}
    </p>
  );
}
