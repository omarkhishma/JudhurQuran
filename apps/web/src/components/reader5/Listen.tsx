"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/Icon";
import { useAudio } from "@/lib/store/audio";

/** The word as recited at this place: a slice of the verse recitation by its word timings (D10) —
 * never synthesised speech for the Quran. */
export function ListenOccurrence({ location, tokenFrom, tokenTo }: { location: string; tokenFrom: number; tokenTo: number }) {
  const t = useTranslations("rd");
  const playWord = useAudio((s) => s.playWord);
  const [s, a] = location.split(":");
  return (
    <button type="button" className="listen-btn" onClick={() => void playWord(`${s}:${a}`, tokenFrom, tokenTo)} aria-label={t("hearIt")} title={t("hearIt")}>
      <Icon name="play" size={14} />
    </button>
  );
}
