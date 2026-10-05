"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { getJSON } from "@/lib/reader/api";
import { usePrefs } from "@/lib/reader/store";

type Words = Record<string, [string | null, string | null, string | null, string | null]>;
type Payload = { words: Words; meanings_from: { title_ar: string; title_en: string; publisher_ar: string; publisher_en: string } | null };

/**
 * Word by word (B2): under each word of the mushaf its meaning at its place — al-Muyassar fī Gharīb al-Qurʾān's in
 * Arabic, verbatim, under the first word of the phrase it explains; the corpus's English gloss in English — then its
 * root's letters and its lemma's pattern. The lines are set on the words already on the page and drawn by the
 * stylesheet, so al-Baqara's six thousand words stay light; off, nothing is left behind.
 */
export function Interlinear({ chapter }: { chapter: number }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const on = usePrefs((s) => s.interlinear);
  const q = useQuery({ queryKey: ["surah-interlinear", chapter], queryFn: () => getJSON<Payload>(`/surahs/${chapter}/interlinear`), enabled: on, staleTime: Infinity });

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".reading");
    if (!root) return;
    const words = root.querySelectorAll<HTMLElement>(".w[data-w]");
    if (!on || !q.data) {
      delete root.dataset.interlinear;
      words.forEach((w) => w.removeAttribute("data-il"));
      return;
    }
    root.dataset.interlinear = "on";
    words.forEach((w) => {
      const x = q.data.words[w.dataset.w ?? ""];
      if (!x) return w.removeAttribute("data-il");
      const [meaning, gloss, rootLetters, pattern] = x;
      const lines = [locale === "ar" ? meaning : gloss, rootLetters, pattern].filter(Boolean);
      if (lines.length) w.dataset.il = lines.join("\n");
      else w.removeAttribute("data-il");
    });
  }, [on, q.data, locale]);

  if (!on) return null;
  const from = q.data?.meanings_from;
  return (
    <p className="interlinear-credit text-[12px] leading-relaxed text-t3">
      {locale === "ar" && from ? t("interlinearCreditAr", { work: from.title_ar, publisher: from.publisher_ar.split("،")[0] }) : t("interlinearCreditEn")}
    </p>
  );
}
