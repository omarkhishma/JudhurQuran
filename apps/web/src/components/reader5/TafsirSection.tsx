"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { verseRef } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { findWord } from "@/lib/reader/findWord";
import { usePrefs, useReader } from "@/lib/reader/store";
import type { Commentary, Work } from "@/lib/types";

export function useCommentary(verseKey: string | null, works: string[], initialData?: Commentary) {
  return useQuery({
    queryKey: ["commentary", verseKey, works.join(",")],
    enabled: !!verseKey && works.length > 0,
    queryFn: () => getJSON<Commentary>(`/verses/${verseKey}/commentary?works=${encodeURIComponent(works.join(","))}`),
    initialData,
  });
}

const MAX_COMPARE = 3;

/**
 * The verse's tafsir (P2.5a, P2.10): one work at a time, or up to three side by side (columns when the
 * panel is wide enough, stacked when it is not); the chosen translation below; every work credited. The word the
 * reader opened in this verse is marked where each work names it (B3), and a work that never names it says so.
 */
export function TafsirSection({ verseKey }: { verseKey: string }) {
  const t = useTranslations("panel");
  const tr = useTranslations("rd");
  const locale = useLocale();
  const tafsirs = usePrefs((s) => s.tafsirs);
  const translation = usePrefs((s) => s.translation);
  const [mode, setMode] = useState<"one" | "compare">("one");
  const [active, setActive] = useState<string>(tafsirs[0] ?? "muyassar");
  const [picked, setPicked] = useState<string[]>(tafsirs.slice(0, 2));
  const works = useQuery({ queryKey: ["works"], queryFn: async () => (await getJSON<{ data: Work[] }>("/works")).data, staleTime: Infinity });
  const shown = mode === "one" ? [active] : picked;
  const { data, isLoading, isError } = useCommentary(verseKey, [...shown, translation]);
  const trans = data?.data.find((d) => d.work.id === translation);
  const tafsirWorks = (works.data ?? []).filter((w) => w.kind === "tafsir");
  // the word the reader opened last, when it stands in this verse: its everyday spelling is what the tafsirs write
  const focusAt = useReader((s) => {
    const last = s.history[s.cursor]?.at;
    return last && last.startsWith(`${verseKey}:`) ? last : null;
  });
  const focus = useQuery({ queryKey: ["word-at", focusAt], enabled: !!focusAt, staleTime: Infinity, queryFn: () => getJSON<{ text_imlaei: string; text_uthmani: string }>(`/words/${focusAt}`) });
  const [marking, setMarking] = useState(true);
  const word = marking ? (focus.data?.text_imlaei ?? null) : null;

  function pick(id: string) {
    if (mode === "one") return setActive(id);
    // at most three columns, the oldest dropped first (as in the dictionaries' side by side)
    setPicked((p) => (p.includes(id) ? (p.length > 1 ? p.filter((x) => x !== id) : p) : [...p, id].slice(-MAX_COMPARE)));
  }

  return (
    <>
      <section className="passage-tools flex flex-col gap-2 border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="label-caps flex-1">{t("chooseTafsir")}</p>
          <Segmented
            label={tr("tafsirView")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "one", label: tr("tafsirOne") },
              { value: "compare", label: tr("tafsirCompare") },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("chooseTafsir")}>
          {tafsirWorks.map((w) => {
            const on = shown.includes(w.id);
            return (
              <button key={w.id} type="button" aria-pressed={on} className={"chip " + (on ? "is-on" : "")} onClick={() => pick(w.id)}>
                <span className="ar-classical text-[14px]" lang="ar">{w.title_ar}</span>
              </button>
            );
          })}
        </div>
        {mode === "compare" && <p className="text-[11px] text-t3">{tr("tafsirCompareNote")}</p>}
        {focus.data && (
          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-t2">
            <span>
              {t.rich(marking ? "tafsirMarked" : "tafsirUnmarked", {
                word: () => (
                  <span className="ar-classical text-[15px] text-t1" lang="ar">
                    {focus.data.text_uthmani}
                  </span>
                ),
              })}
            </span>
            <button type="button" className="btn min-h-[36px] px-2.5 text-[12px]" aria-pressed={marking} onClick={() => setMarking((m) => !m)}>
              {t(marking ? "tafsirUnmark" : "tafsirMark")}
            </button>
          </p>
        )}
      </section>
      <section className={"tafsir-cols px-4 py-4" + (mode === "compare" ? " is-compare" : "")} aria-busy={isLoading}>
        {isLoading && <p className="text-t3">…</p>}
        {isError && <p className="text-[12.5px] text-bad" role="alert">{t("loadFailed")}</p>}
        {shown.map((id) => {
          const c = data?.data.find((d) => d.work.id === id);
          if (!c) return null;
          return (
            <article key={id} className="flex min-w-0 flex-col gap-2">
              {mode === "compare" && <p className="ar-classical text-[15px] font-bold" lang="ar">{c.work.title_ar}</p>}
              {c.passage ? (
                <>
                  {c.passage.verse_from !== c.passage.verse_to && (
                    <p className="text-[12px] text-t3">{t("passageRange", { from: verseRef(c.passage.verse_from, locale), to: verseRef(c.passage.verse_to, locale) })}</p>
                  )}
                  <div className="ar-classical whitespace-pre-line text-[17px] leading-[2.05] text-t1" dir="rtl" lang="ar">
                    <Marked text={c.passage.text} word={word} />
                  </div>
                  {word && findWord(c.passage.text, word).length === 0 && <p className="text-[12px] text-t3">{t("tafsirNotNamed")}</p>}
                </>
              ) : (
                <p className="text-t3">{t("noPassage")}</p>
              )}
              <WorkCredit work={c.work} />
            </article>
          );
        })}
      </section>
      {trans?.passage && (
        <section className="border-t border-line px-4 py-4">
          <p className="label-caps mb-2">{t("translationTab")} — {trans.work.title_en}</p>
          <p className="text-[15px] leading-relaxed text-t1" dir="ltr" lang="en">{trans.passage.text}</p>
          {trans.passage.footnotes && (
            <details className="mt-2 text-[13px] text-t2" dir="ltr" lang="en">
              <summary className="more-toggle cursor-pointer text-t3">{t("footnotes")}</summary>
              <p className="mt-1 whitespace-pre-line">{trans.passage.footnotes}</p>
            </details>
          )}
          <WorkCredit work={trans.work} />
        </section>
      )}
    </>
  );
}

function WorkCredit({ work }: { work: Work }) {
  const locale = useLocale();
  const t = useTranslations("panel");
  return (
    <p className="mt-1 border-t border-line pt-2 text-[11.5px] leading-relaxed text-t3">
      {locale === "ar" ? `${work.title_ar} — ${work.author_ar}` : `${work.title_en} — ${work.author_en}`}
      {" • "}
      {t("version", { version: work.version })}
      {" • "}
      <a href={work.source_url} target="_blank" rel="noreferrer" className="hover:underline">
        {locale === "ar" ? work.attribution_ar : work.attribution_en}
      </a>
    </p>
  );
}

/** The text with the word marked where it stands; the text itself as it is. */
function Marked({ text, word }: { text: string; word: string | null }) {
  const ranges = word ? findWord(text, word) : [];
  if (!ranges.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([from, to], i) => {
    if (from > at) parts.push(<Fragment key={`t${i}`}>{text.slice(at, from)}</Fragment>);
    parts.push(
      <mark key={`m${i}`} className="tafsir-mark">
        {text.slice(from, to)}
      </mark>,
    );
    at = to;
  });
  if (at < text.length) parts.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <>{parts}</>;
}
