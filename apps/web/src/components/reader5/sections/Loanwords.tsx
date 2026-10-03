"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { LoanwordEntry } from "@/lib/reader/types";

type Dispute = {
  source: { title_ar: string; title_en: string; attribution_ar: string; attribution_en: string; licence: string; licence_url: string };
  views: { id: string; stated_as_ar: string | null; held_by_ar: string[]; passages: { id: string; text_ar: string; page: number | null }[] }[];
};
const VIEWS = ["denial", "occurrence", "author", "reconciliation"] as const;

/**
 * What al-Suyūṭī reports about this word's being non-Arabic (P3.7a): his entry in «المهذب فيما وقع في القرآن
 * من المعرب», verbatim with its page and the languages it names — beside the dispute over whether the Quran
 * holds such words at all, every view with the names the text gives (law: disagreements shown with
 * attribution). Extracted mechanically, unreviewed, and said so.
 */
export function LoanwordsBlock({ items }: { items: LoanwordEntry[] }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [wide, setWide] = useState<Record<string, boolean>>({});
  const [dispute, setDispute] = useState(false);
  const d = useQuery({ queryKey: ["loanword-dispute"], queryFn: () => getJSON<Dispute>("/loanwords/dispute"), enabled: dispute, staleTime: Infinity });
  return (
    <section className="loanwords" aria-label={t("loanTitle")}>
      <p className="label-caps">{t("loanTitle")}</p>
      {items.map((e) => {
        const langs = [...new Map(e.languages.map((l) => [l.key, l])).values()];
        return (
          <article key={e.id} className="loanword-entry">
            <p className={"text-[14.5px] leading-[1.9] text-t1" + (wide[e.id] ? "" : " is-clamped")} lang="ar" dir="rtl">{e.text_ar}</p>
            {e.text_ar.length > 280 && (
              <button type="button" className="self-start text-[12px] text-t2 underline-offset-2 hover:underline" aria-expanded={!!wide[e.id]} onClick={() => setWide((w) => ({ ...w, [e.id]: !w[e.id] }))}>
                {wide[e.id] ? t("showLess") : t("readWholePassage")}
              </button>
            )}
            {langs.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-t3">
                {t("loanLanguages")}
                {langs.map((l) => (
                  <span key={l.key} className="chip text-[11.5px]" lang="ar">{locale === "ar" ? l.name_ar : l.name_en}</span>
                ))}
              </p>
            )}
            <p className="text-[11px] text-t3">
              {locale === "ar" ? e.attribution_ar : e.attribution_en}
              {e.page != null && ` • ${t("loanPage", { page: formatNumber(e.page, locale) })}`}
              {e.confidence !== "exact" ? ` • ${t("loanLinkInferred")}` : ""}
            </p>
          </article>
        );
      })}
      <button type="button" className="loan-dispute-toggle self-start text-[12.5px] text-t2 underline-offset-2 hover:underline" aria-expanded={dispute} onClick={() => setDispute((x) => !x)}>
        {t("loanDispute")}
      </button>
      {dispute && d.isLoading && <div className="h-20 animate-pulse rounded-lg bg-card-2" aria-busy="true" />}
      {dispute && d.isError && <p className="text-[12.5px] text-bad" role="alert">{t("loadFailed")}</p>}
      {dispute && d.data && (
        <div className="loan-dispute flex flex-col gap-3">
          {d.data.views
            .filter((v): v is Dispute["views"][number] & { id: (typeof VIEWS)[number] } => (VIEWS as readonly string[]).includes(v.id))
            .map((v) => (
              <section key={v.id} className="loan-view" aria-label={t(`loanView_${v.id}`)}>
                <p className="text-[13px] font-medium text-t1">{t(`loanView_${v.id}`)}</p>
                {v.held_by_ar.length > 0 && v.id !== "author" && (
                  <p className="text-[11.5px] text-t3" lang="ar" dir="rtl">{t("loanHeldBy")} {v.held_by_ar.join("؛ ")}</p>
                )}
                {v.passages.map((p) => (
                  <p key={p.id} className="text-[14px] leading-[1.9] text-t1" lang="ar" dir="rtl">
                    {p.text_ar}
                    {p.page != null && <span className="mono text-[10.5px] text-t3"> {formatNumber(p.page, locale)}</span>}
                  </p>
                ))}
              </section>
            ))}
          <p className="text-[11px] text-t3">— {locale === "ar" ? d.data.source.attribution_ar : d.data.source.attribution_en}</p>
        </div>
      )}
      <p className="text-[11px] text-t3">{t("loanStatus")}</p>
    </section>
  );
}
