"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { getJSON } from "@/lib/reader/api";
import { usePrefs } from "@/lib/reader/store";
import type { Surah } from "@/lib/types";

/**
 * The way to the sūra before and after this one (B6): in the mushaf's order, or — the reader's choice — in the
 * traditional order of revelation, each step naming the sūra it leads to. The server's links are the mushaf's; the
 * reader's order is read once the page is in the browser.
 */
export function SurahSteps({ number }: { number: number }) {
  const t = useTranslations("rd");
  const client = useIsClient();
  const order = usePrefs((s) => s.order);
  const revelation = client && order === "revelation";
  const surahs = useQuery({ queryKey: ["surahs"], queryFn: () => getJSON<{ data: Surah[] }>("/surahs"), staleTime: Infinity, enabled: revelation });
  if (revelation && surahs.data) {
    const here = surahs.data.data.find((s) => s.number === number);
    const at = (o: number) => surahs.data.data.find((s) => s.revelation_order === o);
    const prev = here ? at(here.revelation_order - 1) : undefined;
    const next = here ? at(here.revelation_order + 1) : undefined;
    return (
      <nav className="flex w-full justify-between gap-3" aria-label={t("surahNavRevelation")}>
        {prev ? <Link href={`/quran/${prev.number}`} className="btn min-h-[40px]">{t("prevByRevelation", { name: prev.name_ar })}</Link> : <span />}
        {next ? <Link href={`/quran/${next.number}`} className="btn min-h-[40px]">{t("nextByRevelation", { name: next.name_ar })}</Link> : <span />}
      </nav>
    );
  }
  return (
    <nav className="flex w-full justify-between gap-3" aria-label={t("surahNav")}>
      {number > 1 ? <Link href={`/quran/${number - 1}`} className="btn min-h-[40px]">{t("prevSurah")}</Link> : <span />}
      {number < 114 ? <Link href={`/quran/${number + 1}`} className="btn min-h-[40px]">{t("nextSurah")}</Link> : <span />}
    </nav>
  );
}
