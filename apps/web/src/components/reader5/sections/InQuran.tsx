"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { cnt, cnt2, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { Attestation, WordPayload } from "@/lib/reader/types";
import type { ChapterInfo } from "../ReaderShell";

/**
 * In the Quran (P2.5, RDR-558): every occurrence of the lemma, grouped by surface form, with the
 * Makki/Madani split and the spread across sūras; the list pages through all of them (ع ل م alone
 * has 854 on the root). KWIC rows hug the keyword.
 */
export function InQuranSection({ w, chapter }: { w: WordPayload; chapter: ChapterInfo }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [form, setForm] = useState<string | null>(null);
  const a = w.attestations;
  const pages = useInfiniteQuery({
    queryKey: ["attest", w.slug, form],
    queryFn: ({ pageParam }) =>
      getJSON<{ data: Attestation[]; next_cursor: string | null }>(
        `/words/${encodeURIComponent(w.slug)}/attestations?limit=30${pageParam ? `&cursor=${pageParam}` : ""}${form ? `&form=${encodeURIComponent(form)}` : ""}`,
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows = pages.data?.pages.flatMap((p) => p.data) ?? [];
  const here = a.by_chapter.find((c) => c.surah === chapter.number)?.occurrences ?? 0;
  const maxCh = Math.max(1, ...a.by_chapter.map((c) => c.occurrences));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-t2">
        {t("inQuranSummary", { ...cnt(a.total, locale), ...cnt2(a.by_chapter.length, locale), here: formatNumber(here, locale), surah: chapter.nameAr })}
      </p>
      <div className="flex gap-3 text-[12px] text-t2">
        <span>{t("meccanCount", { n: formatNumber(a.meccan, locale) })}</span>
        <span>{t("medinanCount", { n: formatNumber(a.medinan, locale) })}</span>
      </div>
      <div className="dist-strip" role="group" aria-label={t("distributionAria")}>
        {a.by_chapter.map((c) => (
          <Link
            key={c.surah}
            href={`/quran/${c.surah}`}
            className={"dist-bar" + (c.surah === chapter.number ? " is-here" : "")}
            style={{ blockSize: `${Math.max(8, (c.occurrences / maxCh) * 100)}%` }}
            title={`${c.name_ar} · ${c.occurrences}`}
            aria-label={`${c.name_ar} ${c.occurrences}`}
          />
        ))}
      </div>
      {a.forms.length > 1 && (
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
      <ol className="flex flex-col divide-y divide-line">
        {rows.map((r) => (
          <li key={r.location} className="kwic-row">
            <Link href={`/quran/${r.verse_key.split(":")[0]}?w=${encodeURIComponent(w.slug)}&at=${r.location}#v${r.verse_key.split(":")[1]}`} className="mono text-[11px] text-t3 hover:text-t1" dir="ltr">
              {r.verse_key}
            </Link>
            <span className="kwic quran" dir="rtl" lang="ar">
              <span className="kwic-side kwic-before">{r.left}</span>
              <mark className="kwic-key">{r.keyword}</mark>
              <span className="kwic-side kwic-after">{r.right}</span>
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
