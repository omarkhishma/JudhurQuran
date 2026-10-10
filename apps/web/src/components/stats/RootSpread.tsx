"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Figure, RampKey } from "@/components/charts/Figure";
import { PageGrid } from "@/components/charts/Heatmap";
import { SurahColumns } from "@/components/charts/SurahColumns";
import { Link, useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { Distribution } from "@/lib/stats";

/**
 * A root through the Quran (P16.3): its words per thousand in each sūra, in the mushaf's order or the order of
 * revelation, and the mushaf's 604 pages shaded by its words on each — with its mind map and the statistics one press
 * away. Read when the section comes into view (the root page is long); the numbers are the API's.
 */
export function RootSpread({ rootKey, spaced }: { rootKey: string; spaced: string }) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const router = useRouter();
  const [by, setBy] = useState<"mushaf" | "revelation">("revelation");
  const q = useQuery({ queryKey: ["stats-dist", rootKey], queryFn: () => getJSON<Distribution>(`/stats/distribution?root=${encodeURIComponent(rootKey)}`), staleTime: Infinity });
  const n = (x: number) => formatNumber(x, locale);
  if (!q.data) return q.isError ? null : <span className="block h-40 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  const d = q.data;
  return (
    <div className="stats-grid">
      <Figure
        id="rspread"
        title={t("rootThrough", { root: spaced })}
        caption={t("rootSpreadCaption", { total: n(d.total), verses: n(d.verses) })}
        legend={
          <div className="seg-group" role="group" aria-label={t("order")}>
            {(["revelation", "mushaf"] as const).map((v) => (
              <button key={v} type="button" className={"seg" + (by === v ? " is-on" : "")} aria-pressed={by === v} onClick={() => setBy(v)}>
                {t(v === "mushaf" ? "orderMushaf" : "orderRevelation")}
              </button>
            ))}
          </div>
        }
      >
        <SurahColumns label={t("rootThrough", { root: spaced })} by={by} data={d.surahs.map((s) => ({ surah: s.surah, name: locale === "ar" ? s.name_ar : s.name_translit, place: s.place, order: s.revelation_order, value: s.per_1000, extra: t("countIn", { n: n(s.count) }) }))} onPick={(s) => router.push(`/stats/surah/${s}`)} />
      </Figure>
      <Figure id="rpages" title={t("rootPages", { root: spaced })} caption={t("rootPagesCaption")} legend={<RampKey hue="var(--chart-root)" low={t("none")} high={t("most")} />}>
        <PageGrid pages={d.pages} label={t("rootPages", { root: spaced })} onPage={(p) => router.push(`/mushaf/${p}`)} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/mindmap?root=${encodeURIComponent(rootKey)}`} className="btn">{t("mindTitle")}</Link>
          <Link href="/stats/relations" className="btn">{t("relTitle")}</Link>
        </div>
      </Figure>
    </div>
  );
}
