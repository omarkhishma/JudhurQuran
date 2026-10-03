"use client";

import { useLocale } from "next-intl";
import { useIsClient } from "@/lib/client";
import { usePrefs } from "@/lib/reader/store";

/** Whether transliteration lines show: the reader's own setting, else the language's default — off in Arabic, on
 * in English (RDR-116, COL-Q06). Every screen that prints a transliteration line asks this. */
export function useTranslitOn(): boolean {
  const locale = useLocale();
  const client = useIsClient();
  const pref = usePrefs((s) => s.translitLine);
  return (client ? pref : null) ?? locale !== "ar";
}
