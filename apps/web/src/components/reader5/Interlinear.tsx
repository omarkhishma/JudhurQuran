"use client";

import { useQueries } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
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
export function Interlinear({ chapters }: { chapters: number[] }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const on = usePrefs((s) => s.interlinear);
  // every sūra on the surface — a page of the mushaf may hold more than one (B1) — its words by their place
  const qs = useQueries({ queries: chapters.map((c) => ({ queryKey: ["surah-interlinear", c], queryFn: () => getJSON<Payload>(`/surahs/${c}/interlinear`), enabled: on, staleTime: Infinity })) });
  const loaded = qs.every((x) => x.data);
  const stamp = qs.map((x) => x.dataUpdatedAt).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the queries' answers, by when each came
  const q = useMemo(() => ({ data: loaded ? { words: Object.assign({}, ...qs.map((x) => x.data!.words)) as Words, meanings_from: qs[0]?.data?.meanings_from ?? null } : undefined }), [loaded, stamp]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".reading");
    if (!root) return;
    const words = root.querySelectorAll<HTMLElement>(".w[data-w]");
    const data = q.data;
    if (!on || !data) {
      delete root.dataset.interlinear;
      words.forEach((w) => w.removeAttribute("data-il"));
      return;
    }
    root.dataset.interlinear = "on";
    words.forEach((w) => {
      const x = data.words[w.dataset.w ?? ""];
      if (!x) return w.removeAttribute("data-il");
      const [meaning, gloss, rootLetters, pattern] = x;
      const lines = [locale === "ar" ? meaning : gloss, rootLetters, pattern].filter(Boolean);
      if (lines.length) w.dataset.il = lines.join("\n");
      else w.removeAttribute("data-il");
    });
  }, [on, q.data, locale]);

  // the credit names what is drawn under the words, so it waits for them
  if (!on || !q.data) return null;
  const from = q.data.meanings_from;
  return (
    <p className="interlinear-credit text-[12px] leading-relaxed text-t3">
      {locale !== "ar" ? t("interlinearCreditEn") : from ? t("interlinearCreditAr", { work: from.title_ar, publisher: from.publisher_ar.split("،")[0] }) : t("interlinearCreditArBare")}
    </p>
  );
}
