"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { EntryPage, Passage, SurahGroupings } from "@/lib/editorial";
import { cnt, cnt2, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { DirectBar, useDirect } from "./Direct";

type SurahVerse = { ayah: number; key: string; text_qpc: string };
const PART = 100;

/** A sūra's verses as the mushaf writes them, read a hundred at a time. */
export function useSurahVerses(n: number, count: number | undefined) {
  return useQuery({
    queryKey: ["surah-verses", n],
    enabled: !!count,
    staleTime: Infinity,
    queryFn: async () => {
      const parts: Promise<{ verses: SurahVerse[] }>[] = [];
      for (let a = 1; a <= (count ?? 0); a += PART) parts.push(getJSON(`/surahs/${n}?start=${a}&end=${Math.min(count!, a + PART - 1)}`));
      return (await Promise.all(parts)).flatMap((p) => p.verses);
    },
  });
}

/** The value written as boundaries: the verses (after the first) that open a passage, each passage's title, and the
 * passages left out (not yet decided — saved as a gap). */
type Shape = { bounds: number[]; titles: Record<number, string>; out: number[] };

function toShape(passages: Passage[], n: number): Shape {
  const ps = [...passages].sort((a, b) => a.from - b.from);
  const bounds = new Set<number>();
  const out: number[] = [];
  const titles: Record<number, string> = {};
  let at = 1;
  for (const p of ps) {
    if (p.from > at) {
      if (at > 1) bounds.add(at);
      out.push(at);
    }
    if (p.from > 1) bounds.add(p.from);
    if (p.title_ar) titles[p.from] = p.title_ar;
    at = p.to + 1;
  }
  if (ps.length && at <= n) {
    bounds.add(at);
    out.push(at);
  }
  return { bounds: [...bounds].sort((a, b) => a - b), titles, out };
}

function toPassages(s: Shape, n: number): Passage[] {
  const starts = [1, ...s.bounds.filter((b) => b > 1 && b <= n)];
  return starts
    .map((a, i) => ({ from: a, to: (starts[i + 1] ?? n + 1) - 1, title_ar: s.titles[a] ?? "", title_en: "" }))
    .filter((p) => !s.out.includes(p.from));
}

/**
 * A sūra's passages (P14.4, D32): the sūra's verses in the mushaf's text, a boundary between any two of them set or
 * lifted with one press, and beside each boundary the sources that open a run of verses there — the rukūʿ, each
 * tafsir's passages, each commentary's stated ranges — with how many agree. A source's boundaries can be taken whole
 * as a start. Each passage may be named and may be left out (a gap the reader is told is undecided). Every word inside
 * a passage in force takes the passage as its context, unless it has a range of its own.
 */
export function PassagesTool({ surah, role, onBack }: { surah: number; role: string; onBack: () => void }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const first = (page: EntryPage) => ({ passages: [{ from: 1, to: Number(page.target.verse_count), title_ar: "", title_en: "" }] });
  const work = useDirect("context_passages", String(surah), first);
  const page = work.page;
  const n = page ? Number(page.target.verse_count) : 0;
  const verses = useSurahVerses(surah, n || undefined);
  const groupings = page?.candidates as SurahGroupings | undefined;
  const [shown, setShown] = useState<string[] | null>(null);
  const shape = useMemo(() => (work.value ? toShape(work.value.passages as Passage[], n) : { bounds: [], titles: {}, out: [] }), [work.value, n]);

  if (work.q.isPending) return <span className="block h-64 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!page || !groupings) return <p role="alert" className="text-[13px] text-t2">{t("loadFailed")}</p>;
  const sources = groupings.sources;
  const visible = shown ?? sources.map((s) => s.source);
  const put = (s: Shape) => work.setValue({ passages: toPassages(s, n) });
  const toggle = (a: number) => put({ ...shape, bounds: shape.bounds.includes(a) ? shape.bounds.filter((b) => b !== a) : [...shape.bounds, a].sort((x, y) => x - y), out: shape.out.filter((o) => o !== a) });
  const starts = [1, ...shape.bounds];
  const passageOf = (a: number) => starts.filter((s) => s <= a).at(-1) ?? 1;
  const short = (id: string) => (t.has(`srcShort.${id}`) ? t(`srcShort.${id}`) : id);
  const opens = (a: number) => (groupings.opens[String(a)] ?? []).filter((s) => visible.includes(s));
  const name = locale === "ar" ? page.target.label : page.target.translit;

  return (
    <article className="flex flex-col gap-4" aria-labelledby="passages-h">
      <button type="button" className="btn self-start text-[12.5px]" onClick={onBack}>{t("back")}</button>
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 id="passages-h" className="text-[22px] font-semibold text-t1">{t("ctxSurahTitle", { name, n: formatNumber(surah, locale) })}</h2>
        <span className="text-[12.5px] text-t3">{t("ctxSurahCounts", { ...cnt(n, locale), ...cnt2(toPassages(shape, n).length, locale) })}</span>
      </header>
      <p className="text-[12.5px] leading-relaxed text-t3">{t("kindLead_context_passages")}</p>

      <section className="workbench-box" aria-labelledby="srcs-h">
        <h3 id="srcs-h" className="text-[13.5px] font-semibold">{t("ctxSources")}</h3>
        <p className="text-[12px] text-t3">{t("ctxSourcesLead")}</p>
        <ul className="flex flex-col gap-1.5">
          {sources.map((s) => (
            <li key={s.source} className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={visible.includes(s.source)} onChange={(e) => setShown(e.target.checked ? [...visible, s.source] : visible.filter((x) => x !== s.source))} />
                <span className="text-t1">{short(s.source)}</span>
              </label>
              <span className="text-t3">{t("ctxSourceRuns", cnt(s.runs.length, locale))}</span>
              <button type="button" className="chip text-[11.5px]" onClick={() => put({ bounds: s.runs.map(([a]) => a).filter((a) => a > 1), titles: shape.titles, out: [] })}>
                {t("ctxTakeSource")}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn self-start text-[12px]" onClick={() => put({ bounds: [], titles: {}, out: [] })}>{t("ctxClear")}</button>
      </section>

      {verses.isPending ? (
        <span className="block h-64 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />
      ) : !verses.data ? (
        <p role="alert" className="text-[13px] text-t2">{t("loadFailed")}</p>
      ) : (
        <ol className="passages-list">
          {verses.data.map((v) => {
            const a = v.ayah;
            const isStart = a === 1 || shape.bounds.includes(a);
            const p = passageOf(a);
            const out = shape.out.includes(p);
            const marks = a > 1 ? opens(a) : [];
            return (
              <li key={a} className={"passage-verse" + (out ? " is-out" : "")}>
                {a > 1 && (
                  <div className="passage-bound">
                    <button type="button" className={"bound-toggle" + (isStart ? " is-on" : "")} aria-pressed={isStart} onClick={() => toggle(a)} aria-label={t(isStart ? "ctxBoundOff" : "ctxBoundOn", { n: formatNumber(a, locale) })}>
                      <span aria-hidden="true">{isStart ? "—" : "+"}</span>
                    </button>
                    {marks.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1 text-[11px] text-t3">
                        <span>{t("ctxOpensHere", cnt(marks.length, locale))}</span>
                        {marks.map((m) => (
                          <span key={m} className="bound-src">{short(m)}</span>
                        ))}
                      </span>
                    )}
                  </div>
                )}
                {isStart && (
                  <div className="passage-head">
                    <span className="label-caps">{t("ctxPassageN", { n: formatNumber(starts.indexOf(a) + 1, locale) })}</span>
                    <input className="field-input min-w-0 flex-1 text-[13px]" value={shape.titles[a] ?? ""} placeholder={t("ctxPassageTitle")} aria-label={t("ctxPassageTitle")} onChange={(e) => put({ ...shape, titles: { ...shape.titles, [a]: e.target.value } })} dir="auto" maxLength={200} />
                    <label className="flex items-center gap-1.5 text-[12px] text-t2">
                      <input type="checkbox" checked={!out} onChange={(e) => put({ ...shape, out: e.target.checked ? shape.out.filter((o) => o !== a) : [...shape.out, a] })} />
                      {t("ctxPassageKept")}
                    </label>
                  </div>
                )}
                <p className="passage-text">
                  <span className="quran text-[20px] leading-[2.1] text-t1" lang="ar" dir="rtl">{v.text_qpc}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}
      <DirectBar kind="context_passages" target={String(surah)} work={work} role={role} />
    </article>
  );
}
