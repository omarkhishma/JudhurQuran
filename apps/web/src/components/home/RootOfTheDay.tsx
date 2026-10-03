"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { meccaToday, type WordOfTheDay } from "@/lib/daily";
import { getJSON } from "@/lib/reader/api";

/**
 * The masthead's glyph is the root of the day (HUB-Q02): the root of the word of the day, which Explore
 * presents in full (COL-09). The server renders the day it knows; past Mecca's midnight the browser asks
 * for the new day, so a page served from cache never shows yesterday's root.
 */
export function RootOfTheDay({ initial }: { initial: WordOfTheDay | null }) {
  const t = useTranslations("hub");
  const client = useIsClient();
  const day = client ? meccaToday() : initial?.date;
  const q = useQuery({
    queryKey: ["word-of-the-day", day],
    queryFn: () => getJSON<WordOfTheDay>(`/word-of-the-day?date=${day}`),
    enabled: !!day && day !== initial?.date,
    staleTime: Infinity,
  });
  const w = day === initial?.date ? initial : (q.data ?? initial);
  if (!w) return <div className="hub-glyph-slot" aria-hidden="true" />;
  return (
    <div className="hub-rotd">
      <Link href={`/roots/${encodeURIComponent(w.root.key)}`} className="hub-glyph" lang="ar" dir="rtl" aria-label={t("rootOfDayLink", { root: w.root.ar_spaced })}>
        {w.root.ar_spaced}
      </Link>
      <p className="hub-rotd-cap">
        <span className="label-caps">{t("rootOfDay")}</span>
        <span aria-hidden="true">•</span>
        <Link href={`/read?w=${encodeURIComponent(w.lemma.slug)}`} className="hub-rotd-word">
          {t.rich("wordOfDay", { word: w.lemma.ar.full, w: (c) => <span className="ar-classical text-[17px] text-word" lang="ar">{c}</span> })}
        </Link>
      </p>
    </div>
  );
}
