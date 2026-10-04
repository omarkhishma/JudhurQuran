"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";

type SurahRow = { number: number; name_ar: string; name_translit: string; verse_count: number };

/** The sūras with their names and verse counts, read once. */
export function useSurahs() {
  return useQuery({ queryKey: ["surahs"], queryFn: () => getJSON<{ data: SurahRow[] }>("/surahs"), staleTime: Infinity });
}

/** The sūras' names in the interface's language, by number. */
export function useSurahNames(): Map<number, string> | undefined {
  const locale = useLocale();
  const q = useSurahs();
  return q.data ? new Map(q.data.data.map((s) => [s.number, locale === "ar" ? s.name_ar : s.name_translit])) : undefined;
}

export const useFmt = () => {
  const locale = useLocale();
  return (n: number) => formatNumber(n, locale);
};

/**
 * What an instructor will see of a member, and what never — said before joining and kept on the class's page
 * (research 16 §2). The server enforces each line; this only says it.
 */
export function ConsentText({ minors, floor, level = 3 }: { minors: boolean; floor: number; level?: 2 | 3 }) {
  const t = useTranslations("classroom");
  const fmt = useFmt();
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-t1">
      <section aria-labelledby="consent-sees">
        <H id="consent-sees" className="mb-1 text-[14px] font-semibold">{t("consentSeesTitle")}</H>
        <ul className="flex list-disc flex-col gap-1 ps-5">
          <li>{t("consentName")}</li>
          <li>{t("consentCounts", { floor: fmt(floor) })}</li>
          <li>{t("consentProgress")}</li>
          <li>{t(minors ? "consentDetailMinors" : "consentDetail")}</li>
        </ul>
      </section>
      <section aria-labelledby="consent-never">
        <H id="consent-never" className="mb-1 text-[14px] font-semibold">{t("consentNeverTitle")}</H>
        <p>{t("consentNever")}</p>
      </section>
      <p className="text-[13px] text-t2">{t("consentLeave")}</p>
      {minors && <p className="rounded-lg border border-line bg-card-2 p-3 text-[13px] text-t1">{t("consentMinors")}</p>}
    </div>
  );
}
