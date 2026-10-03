"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getChangelog } from "@/lib/contrib";
import { ContributionCredit } from "./WordContributions";

/**
 * The changelog of contributions (DAT-17, RVQ-61, 08 GET /changelog): every merge and every revert, newest first,
 * with the word, what changed, who proposed and who reviewed it, and the dataset release it was made against —
 * the last link of the chain propose → review → merge → credit → changelog → profile.
 */
export function Changelog() {
  const t = useTranslations("changelog");
  const tc = useTranslations("contrib");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["changelog"], queryFn: getChangelog, staleTime: 30_000 });
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  return (
    <section className="flex flex-col gap-3" aria-labelledby="changelog-title">
      <div>
        <h2 id="changelog-title" className="text-[17px] font-semibold">{t("title")}</h2>
        <p className="text-[12.5px] text-t3">{t("lead")}</p>
      </div>
      {q.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />
      ) : q.isError ? (
        <p className="text-[13px] text-bad" role="alert">{t("failed")}</p>
      ) : !q.data?.data.length ? (
        <p className="text-[13px] text-t2">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {q.data.data.map((e) => (
            <li key={e.entry} className="changelog-row">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-t3">
                <span className={e.event === "merged" ? "text-good" : "text-bad"}>{t(e.event)}</span>
                <span>{date(e.at)}</span>
                <span>{tc(`kind.${e.merge.kind}`)}</span>
                <Link href={`/read?w=${encodeURIComponent(e.merge.lemma)}`} prefetch={false} className="ar-classical text-[17px] text-word" lang="ar">
                  {e.merge.lemma_ar}
                </Link>
                <span className="mono" dir="ltr">{e.dataset_version}</span>
              </p>
              {e.merge.previous_text && <p className="text-[12.5px] text-t3 line-through" dir="auto">{e.merge.previous_text}</p>}
              <p className="text-[14px] leading-[1.8]" dir="auto">{e.merge.text}</p>
              <ContributionCredit m={e.merge} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
