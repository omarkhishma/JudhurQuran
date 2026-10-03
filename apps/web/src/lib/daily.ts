/** The word of the day (API /word-of-the-day, services/api daily.py): one Quranic word per date in Mecca's time zone. */

import type { Ar } from "@/lib/reader/types";

export type WordOfTheDay = {
  date: string;
  timezone: "Asia/Riyadh";
  lemma: { slug: string; ar: Ar; pos: { tag: string; ar: string | null; en: string | null }; gloss_en: string | null; occurrences: number; verse_count: number | null };
  pattern: { slug: string; ar: Ar; function_ar: string | null; function_en: string | null } | null;
  root: { key: string; letters: string[]; ar_spaced: string; translit: string; occurrences: number; lemma_count: number; gist_ar: string | null };
  gist: { text_ar: string; page_ref: string | null; work: { id: string; title_ar: string; title_en: string; author_ar: string; author_en: string; death_hijri: number | null; death_ce: number | null } } | null;
  attestation: {
    location: string;
    verse_key: string;
    surah: { number: number; name_ar: string; name_translit: string };
    ayah: number;
    tokens: string[];
    /** 1-based positions in `tokens` */
    token_from: number;
    token_to: number;
    translation: { text: string; footnotes: unknown } | null;
    translation_work: { id: string; title_ar: string; title_en: string } | null;
  };
  pool: number;
};

/** The calendar day in Mecca (YYYY-MM-DD): the word changes at Mecca's midnight for everyone. */
export function meccaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
