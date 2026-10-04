"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { formatNumber, verseRef } from "@/lib/format";
import type { OccurrencesPage } from "@/lib/types";

/**
 * KWIC concordance. The keyword column is narrow and the context columns hug it so the eye can scan
 * the keyword vertically; in RTL the "before" context sits to the right of the keyword.
 */
export function Concordance({ root, lemmas }: { root: string; lemmas: { id: number; ar: string; occurrences: number }[] }) {
  const t = useTranslations("roots");
  const locale = useLocale();
  const [lemma, setLemma] = useState<number | null>(null);
  const q = useInfiniteQuery({
    queryKey: ["concordance", root, lemma],
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const r = await fetch(
        `/api/v1/roots/${encodeURIComponent(root)}/occurrences?limit=40${lemma ? `&lemma=${lemma}` : ""}${pageParam ? `&cursor=${pageParam}` : ""}`,
      );
      return (await r.json()) as OccurrencesPage;
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const rows = q.data?.pages.flatMap((p) => p.data) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;

  return (
    <div>
      {lemmas.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={t("allLemmas")}>
          <button type="button" className={"chip " + (lemma === null ? "is-on" : "")} onClick={() => setLemma(null)} aria-pressed={lemma === null}>
            {t("allLemmas")}
          </button>
          {lemmas.map((l) => (
            <button key={l.id} type="button" className={"chip " + (lemma === l.id ? "is-on" : "")} onClick={() => setLemma(l.id)} aria-pressed={lemma === l.id}>
              <span className="ar-classical text-[15px]" lang="ar">{l.ar}</span>
              <span className="mono text-[11px] text-t3">{formatNumber(l.occurrences, locale)}</span>
            </button>
          ))}
        </div>
      )}
      {/* One shared grid (subgrid rows) so every keyword sits in the same column and the eye can scan it. */}
      <ol className="overflow-hidden rounded-xl border border-line bg-card md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_3.5rem]" dir="rtl">
        {rows.map((o, i) => (
          <li key={o.location} className={"md:col-span-full md:grid md:grid-cols-subgrid " + (i ? "border-t border-line" : "")}>
            {/* Phone: the snippet reads as a sentence with the keyword marked */}
            <Link
              href={`/quran/${o.verse_key.split(":")[0]}?at=${o.location}#v${o.verse_key.split(":")[1]}`}
              className="block px-3 py-2 hover:bg-card-2 md:hidden"
            >
              <span className="quran line-clamp-2 text-[19px] leading-[2.1]" lang="ar">
                <span className="text-t2">{tail(o.left, 6)} </span>
                <mark className="rounded bg-root-wash px-0.5 text-root">{o.keyword}</mark>
                <span className="text-t2"> {head(o.right, 6)}</span>
              </span>
              <span className="mono text-[11.5px] text-t3" dir="ltr">{verseRef(o.verse_key, locale)}</span>
            </Link>
            <Link
              href={`/quran/${o.verse_key.split(":")[0]}?at=${o.location}#v${o.verse_key.split(":")[1]}`}
              className="hidden items-center gap-x-2 px-3 py-1.5 hover:bg-card-2 md:col-span-full md:grid md:grid-cols-subgrid"
            >
              <span className="quran truncate text-start text-[18px] leading-[2.1] text-t2 [direction:ltr]" lang="ar">
                <span dir="rtl">{o.left}</span>
              </span>
              <span className="quran justify-self-center rounded-md bg-root-wash px-1.5 text-[19px] leading-[2.1] text-root" lang="ar">{o.keyword}</span>
              <span className="quran truncate text-[18px] leading-[2.1] text-t2" lang="ar">{o.right}</span>
              <span className="mono text-end text-[11.5px] text-t3" dir="ltr">{verseRef(o.verse_key, locale)}</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center justify-between gap-3 text-[13px] text-t3">
        <span aria-live="polite">{t("shownOf", { shown: formatNumber(rows.length, locale), total: formatNumber(total, locale) })}</span>
        {q.hasNextPage && (
          <button type="button" className="btn" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {t("loadMore")}
          </button>
        )}
      </div>
    </div>
  );
}

function tail(s: string, n: number): string {
  const p = s.split(" ").filter(Boolean);
  return (p.length > n ? "… " : "") + p.slice(-n).join(" ");
}

function head(s: string, n: number): string {
  const p = s.split(" ").filter(Boolean);
  return p.slice(0, n).join(" ") + (p.length > n ? " …" : "");
}
