"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { Link } from "@/i18n/navigation";
import { cnt, cnt2, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { useReader } from "@/lib/reader/store";
import type { Attestation, WordPayload } from "@/lib/reader/types";
import { tags } from "../GrammarBand";
import type { ChapterInfo } from "../ReaderShell";

type Dist = { surah: number; name_ar: string; name_translit: string; revelation_place: string; occurrences: number }[];
type Page = { data: (Attestation & { lemma_slug: string | null })[]; total: number; next_cursor: string | null };

/**
 * In the Quran (P2.5, RDR-558): every occurrence of the word — or of its whole root — grouped by
 * surface form, with the Makki/Madani split, the spread across sūras (a bar opens the sūra filter) and a
 * sūra filter; the list pages through all of them (ع ل م alone has 854 on the root). KWIC rows hug the
 * keyword.
 */
export function InQuranSection({ w, chapter }: { w: WordPayload; chapter: ChapterInfo }) {
  const t = useTranslations("rd");
  const setHandoff = useReader((s) => s.setHandoff);
  const locale = useLocale();
  const [form, setForm] = useState<string | null>(null);
  const [scope, setScope] = useState<"lemma" | "root">("lemma");
  const [surah, setSurah] = useState<number | null>(null);
  const a = w.attestations;
  const rootDist = useQuery({
    queryKey: ["root-dist", w.root?.key],
    queryFn: () => getJSON<{ distribution: Dist }>(`/roots/${encodeURIComponent(w.root!.key)}`),
    enabled: scope === "root" && !!w.root,
    staleTime: Infinity,
  });
  const dist: Dist = scope === "root" ? (rootDist.data?.distribution ?? []) : a.by_chapter;
  const params = `scope=${scope}${surah ? `&surah=${surah}` : ""}${form && scope === "lemma" ? `&form=${encodeURIComponent(form)}` : ""}`;
  const pages = useInfiniteQuery({
    queryKey: ["attest", w.slug, params],
    queryFn: ({ pageParam }) => getJSON<Page>(`/words/${encodeURIComponent(w.slug)}/attestations?limit=30&${params}${pageParam ? `&cursor=${pageParam}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows = pages.data?.pages.flatMap((p) => p.data) ?? [];
  const total = scope === "root" ? (w.root?.occurrences ?? 0) : a.total;
  const meccan = dist.filter((c) => c.revelation_place === "meccan").reduce((s, c) => s + c.occurrences, 0);
  const here = dist.find((c) => c.surah === chapter.number)?.occurrences ?? 0;
  const maxCh = Math.max(1, ...dist.map((c) => c.occurrences));
  return (
    <div className="flex flex-col gap-3">
      {w.root && (
        <Segmented
          label={t("secInQuran")}
          value={scope}
          onChange={(v) => {
            setScope(v);
            setForm(null);
          }}
          options={[
            { value: "lemma", label: t("scopeWord") },
            { value: "root", label: t("scopeRoot", { root: w.root.ar_spaced }) },
          ]}
        />
      )}
      <p className="text-[13px] text-t2">
        {t("inQuranSummary", { ...cnt(total, locale), ...cnt2(dist.length, locale), here: formatNumber(here, locale), surah: chapter.nameAr })}
      </p>
      <div className="flex gap-3 text-[12px] text-t2">
        <span>{t("meccanCount", { n: formatNumber(scope === "lemma" ? a.meccan : meccan, locale) })}</span>
        <span>{t("medinanCount", { n: formatNumber(scope === "lemma" ? a.medinan : total - meccan, locale) })}</span>
      </div>
      <div className="dist-strip" role="group" aria-label={t("distributionAria")}>
        {dist.map((c) => (
          <button
            key={c.surah}
            type="button"
            className={"dist-bar" + (c.surah === chapter.number ? " is-here" : "") + (c.surah === surah ? " is-on" : "")}
            style={{ blockSize: `${Math.max(8, (c.occurrences / maxCh) * 100)}%` }}
            title={`${c.name_ar} • ${formatNumber(c.occurrences, locale)}`}
            aria-label={`${c.name_ar} ${formatNumber(c.occurrences, locale)}`}
            aria-pressed={c.surah === surah}
            tabIndex={-1}
            onClick={() => setSurah(c.surah === surah ? null : c.surah)}
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-[12px] text-t2">
        <span>{t("surahFilter")}</span>
        <select className="field max-w-[220px] py-1.5 text-[12.5px]" value={surah ?? ""} onChange={(e) => setSurah(e.target.value ? Number(e.target.value) : null)}>
          <option value="">{t("allSurahs")}</option>
          {dist.map((c) => (
            <option key={c.surah} value={c.surah}>
              {`${formatNumber(c.surah, locale)}. ${c.name_ar} (${formatNumber(c.occurrences, locale)})`}
            </option>
          ))}
        </select>
      </label>
      {scope === "lemma" && a.forms.length > 1 && (
        <>
          <p className="label-caps">{t("formsInText")}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("formsInText")}>
            {a.forms.map((f) => (
              <button key={f.form.full} type="button" className={"chip" + (form === f.form.full ? " is-on" : "")} aria-pressed={form === f.form.full} onClick={() => setForm(form === f.form.full ? null : f.form.full)}>
                <span className="quran text-[16px] leading-[1.6]" lang="ar">{f.form.full}</span>
                <span className="mono text-[10.5px] text-t3">{formatNumber(f.occurrences, locale)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {pages.data && (surah || form) && <p className="text-[11.5px] text-t3">{t("filteredN", { n: formatNumber(pages.data.pages[0].total, locale) })}</p>}
      {pages.isError && <p className="text-[12.5px] text-bad" role="alert">{t("loadFailed")}</p>}
      <ol className="long-list flex flex-col divide-y divide-line">
        {rows.map((r) => (
          <li key={r.location} className="kwic-row">
            <Link href={`/quran/${r.verse_key.split(":")[0]}?w=${encodeURIComponent(r.lemma_slug ?? w.slug)}&at=${r.location}#v${r.verse_key.split(":")[1]}`} className="mono text-[11px] text-t3 hover:text-t1" dir="ltr">
              {r.verse_key}
            </Link>
            <span className="kwic quran" dir="rtl" lang="ar">
              <span className="kwic-side kwic-before">{r.left}</span>
              <mark className="kwic-key">{r.keyword}</mark>
              <span className="kwic-side kwic-after">{r.right}</span>
            </span>
            {/* this occurrence's inflection, and a graph seeded from it (RDR-269) */}
            <span className="kwic-meta">
              {r.features && <span className="text-[11px] text-t3">{tags(r.features, locale).join(" • ")}</span>}
              <button type="button" className="text-[11px] text-t3 underline-offset-2 hover:text-t1 hover:underline" onClick={() => setHandoff({ seed: "word", slug: r.lemma_slug ?? w.slug, at: r.location })}>
                {t("tool_graph")}
              </button>
            </span>
          </li>
        ))}
      </ol>
      {pages.hasNextPage && (
        <button type="button" className="btn self-start" onClick={() => pages.fetchNextPage()} disabled={pages.isFetchingNextPage}>
          {t("moreOccurrences")}
        </button>
      )}
      <Link href={`/concordance?root=${encodeURIComponent(w.root?.key ?? "")}`} className="text-[12px] text-word hover:underline">
        {t("openConcordance")}
      </Link>
    </div>
  );
}
