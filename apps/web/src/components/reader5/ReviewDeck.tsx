"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { Link } from "@/i18n/navigation";
import { normalize } from "@/lib/arabic/normalize";
import { useIsClient } from "@/lib/client";
import { cnt, formatNumber, toArabicDigits, verseRef } from "@/lib/format";
import { getJSON, useSurahRoots } from "@/lib/reader/api";
import { usePersonal, useReader } from "@/lib/reader/store";
import type { Ar } from "@/lib/reader/types";
import { dueOrder, type Grade, type ReviewCard, useReview } from "@/lib/store/review";
import { useSaved } from "@/lib/store/saved";
import type { ChapterInfo } from "./ReaderShell";

type RootRef = { key: string; spaced: string };
type Member = { slug: string; ar: Ar; pos: { tag: string; ar: string | null; en: string | null }; gloss_en: string | null; occurrences: number; pattern: { slug: string; ar: Ar } | null };
type RootReview = {
  root: { key: string; spaced: string; translit: string; occurrences: number; lemma_count: number; gist_ar: string | null; gist_page: string | null };
  family: Member[];
  context: { verse_key: string; surah: { number: number; name_ar: string; name_translit: string }; ayah: number; tokens: string[]; blanks: { location: string; token_from: number; token_to: number; surface: string; slug: string | null }[]; translation: { text: string } | null; translation_work: { title_en: string } | null };
};

const SESSION = 20;

/**
 * The roots of the reader's starred and known words (RDR-345, 360: starred, or learning then confirmed), as
 * {key, spaced}. The words go in a POST body; the answer is cached for the session only.
 */
export function useMyRoots() {
  const client = useIsClient();
  const bookmarks = useSaved((s) => s.bookmarks);
  const states = usePersonal((s) => s.wordStates);
  const slugs = useMemo(() => [...new Set([...bookmarks.filter((b) => b.kind === "lemma").map((b) => b.key), ...Object.keys(states).filter((k) => states[k] === "known")])].sort(), [bookmarks, states]);
  return useQuery({
    queryKey: ["my-roots", slugs.join(",")],
    queryFn: async () => {
      const r = await fetch("/api/v1/lemmas/roots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs }) });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { data: { root: RootRef | null }[] };
      const seen = new Map<string, RootRef>();
      for (const x of d.data) if (x.root && !seen.has(x.root.key)) seen.set(x.root.key, { key: x.root.key, spaced: x.root.spaced });
      return [...seen.values()];
    },
    enabled: client && slugs.length > 0,
    staleTime: Infinity,
  });
}

/** The time, moving on every minute: what is due changes as the clock does, not only when something is graded. */
function useNow(step = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), step);
    return () => clearInterval(id);
  }, [step]);
  return now;
}

/** How many of the reader's roots are due now: the header's badge (RDR-346, from the scheduler). */
export function useDueCount(): number | null {
  const mine = useMyRoots();
  const cards = useReview((s) => s.cards);
  const now = useNow();
  if (!mine.data?.length) return null;
  return dueOrder(mine.data.map((r) => r.key), cards, now).length;
}

export function ReviewDeck({ chapter }: { chapter: ChapterInfo }) {
  const open = useReader((s) => s.review);
  const setReview = useReader((s) => s.setReview);
  if (!open) return null;
  return <ReviewSession chapter={chapter} onClose={() => setReview(false)} />;
}

/**
 * A review session (design 03 §9, inventory RDR-344…360): the reader's due roots — forgotten first — or, with
 * nothing of their own, the roots of this sūra; a root card (name the family, reveal each word, grade) or the
 * root in context (a verse with its family words blanked, typed and checked, graded by the score). Grades go
 * to the scheduler, so the session's promise — forgotten families come back first — is kept.
 */
function ReviewSession({ chapter, onClose }: { chapter: ChapterInfo; onClose: () => void }) {
  const t = useTranslations("review");
  const locale = useLocale();
  const mine = useMyRoots();
  const chapterRoots = useSurahRoots(chapter.number);
  const grade = useReview((s) => s.grade);
  // the cards and the clock as the session opened: grading moves a root out of "due", not out of this session
  const [start] = useState(() => ({ cards: useReview.getState().cards, now: Date.now() }));
  const [mode, setMode] = useState<"root" | "context">("root");
  const [results, setResults] = useState<{ root: RootRef; grade: Grade }[]>([]);
  const endBtn = useRef<HTMLButtonElement>(null);

  const own = mine.data ?? [];
  const source: "mine" | "chapter" = own.length ? "mine" : "chapter";
  const pool: RootRef[] = own.length ? own : (chapterRoots.data?.data ?? []).slice().sort((a, b) => b.here - a.here).map((r) => ({ key: r.key, spaced: r.spaced }));
  const byKey = new Map(pool.map((r) => [r.key, r]));
  const queue = (source === "mine" ? dueOrder(pool.map((r) => r.key), start.cards, start.now) : pool.map((r) => r.key)).slice(0, SESSION).map((k) => byKey.get(k)!);
  const loading = mine.isLoading || (!own.length && chapterRoots.isLoading);
  const current = queue[results.length];
  const done = !loading && results.length > 0 && results.length >= queue.length;

  useEffect(() => {
    endBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function graded(g: Grade) {
    if (!current) return;
    grade(current.key, g);
    setResults((r) => [...r, { root: current, grade: g }]);
  }

  const nextDue = Object.values(useReview.getState().cards as Record<string, ReviewCard>)
    .filter((c) => own.some((r) => r.key === c.root))
    .map((c) => c.due)
    .sort((a, b) => a - b)[0];
  const when = (ms: number) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(new Date(ms));

  return (
    <div className="review-overlay" role="dialog" aria-modal="true" aria-label={t("title")}>
      <div className="review-bar">
        <span className="block h-[16px] w-[16px] rounded-[5px] bg-root" aria-hidden="true" />
        <span className="text-[13.5px] font-medium">{t("title")}</span>
        <span className="hidden truncate text-[12px] text-t3 sm:inline">{source === "mine" ? t("metaMine") : t("metaChapter")}</span>
        <span className="flex-1" />
        {queue.length > 0 && !done && (
          <>
            <Segmented label={t("modeLabel")} value={mode} onChange={setMode} options={[{ value: "root", label: t("modeRoot") }, { value: "context", label: t("modeContext") }]} />
            <span className="review-progress" aria-hidden="true">
              <span style={{ width: `${(results.length / queue.length) * 100}%` }} />
            </span>
            <span className="mono text-[12px] text-t3">{t("progress", { n: formatNumber(Math.min(results.length + 1, queue.length), locale), of: formatNumber(queue.length, locale) })}</span>
          </>
        )}
        <button ref={endBtn} type="button" className="btn" onClick={onClose}>{t("end")}</button>
      </div>
      <div className="review-body">
        {loading ? (
          <div className="h-60 w-full max-w-[560px] animate-pulse rounded-2xl bg-card-2" role="status" aria-label={t("loading")} />
        ) : done ? (
          <section className="review-card" aria-labelledby="review-done">
            <h2 id="review-done" className="text-[17px] font-semibold">{t("doneTitle")}</h2>
            <p className="text-[13.5px] text-t2">{t("doneSummary", { k: formatNumber(results.filter((r) => r.grade === "good").length, locale), n: formatNumber(results.length, locale) })}</p>
            <ul className="flex flex-col gap-1.5">
              {results.map((r) => {
                const c = useReview.getState().cards[r.root.key];
                return (
                  <li key={r.root.key} className="flex items-center gap-3 border-b border-line py-1.5">
                    <span className="ar-classical text-[20px] text-root" lang="ar">{r.root.spaced}</span>
                    <span className="flex-1 text-[12px] text-t3">{c ? t("nextReview", { when: when(c.due) }) : ""}</span>
                    <span className={"text-[12.5px] " + (r.grade === "good" ? "text-good" : r.grade === "forgot" ? "text-bad" : "text-t2")}>{t(r.grade)}</span>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn btn-primary self-start" onClick={onClose}>{t("doneBack")}</button>
          </section>
        ) : !queue.length ? (
          <section className="review-card" role="status">
            <p className="text-[14px] leading-relaxed text-t2">{own.length ? (nextDue ? t("caughtUp", { when: when(nextDue) }) : t("caughtUpNone")) : t("empty")}</p>
            {!own.length && <Link href="/explore" className="btn self-start">{t("emptyExplore")}</Link>}
          </section>
        ) : (
          <RootCardLoader key={`${current.key}-${mode}`} root={current} mode={mode} pick={start.cards[current.key]?.reps ?? 0} onGrade={graded} onLeave={onClose} />
        )}
      </div>
    </div>
  );
}

function RootCardLoader({ root, mode, pick, onGrade, onLeave }: { root: RootRef; mode: "root" | "context"; pick: number; onGrade: (g: Grade) => void; onLeave: () => void }) {
  const t = useTranslations("review");
  const q = useQuery({ queryKey: ["root-review", root.key, pick], queryFn: () => getJSON<RootReview>(`/roots/${encodeURIComponent(root.key)}/review?pick=${pick}`), staleTime: Infinity });
  if (q.isLoading) return <div className="h-60 w-full max-w-[560px] animate-pulse rounded-2xl bg-card-2" role="status" aria-label={t("loading")} />;
  if (!q.data)
    return (
      <section className="review-card" role="alert">
        <p className="text-[13.5px] text-bad">{t("failed")}</p>
        <button type="button" className="btn self-start" onClick={() => void q.refetch()}>{t("retry")}</button>
      </section>
    );
  return mode === "root" ? <RootCard d={q.data} onGrade={onGrade} onLeave={onLeave} /> : <ContextCard d={q.data} onGrade={onGrade} />;
}

/** The root card (RDR-349…351): name the family, reveal each word, grade the family. */
function RootCard({ d, onGrade, onLeave }: { d: RootReview; onGrade: (g: Grade) => void; onLeave: () => void }) {
  const t = useTranslations("review");
  const locale = useLocale();
  const [shown, setShown] = useState<Set<string>>(new Set());
  const ar = locale === "ar";
  return (
    <section className="review-card" aria-label={d.root.spaced}>
      <p className="mono text-[11px] uppercase tracking-[.09em] text-root">{t("rootCap", cnt(d.root.lemma_count, locale))}</p>
      <p className="ar-classical px-2 text-[52px] leading-[1.3] tracking-[.08em] text-root" lang="ar">{d.root.spaced}</p>
      <p className="mono text-[12px] text-t3" dir="ltr">{d.root.translit}</p>
      {d.root.gist_ar && (
        <p className="ar-classical text-[16px] leading-[1.8] text-t2" lang="ar" dir="rtl">
          «{d.root.gist_ar}» <span className="text-[11.5px] text-t3">— {t("gistBy", { page: d.root.gist_page ? (ar ? toArabicDigits(d.root.gist_page) : d.root.gist_page) : "" })}</span>
        </p>
      )}
      <p className="text-[13px] text-t2">{t("instruction")}</p>
      <ul className="flex flex-col gap-1.5">
        {d.family.map((m) => {
          const open = shown.has(m.slug);
          const pos = (ar ? m.pos.ar : m.pos.en) ?? m.pos.tag;
          return (
            <li key={m.slug} className={"review-row" + (open ? " is-open" : "")}>
              {open ? (
                <>
                  <span className="ar-classical min-w-[90px] text-[22px] text-word" lang="ar">{m.ar.full}</span>
                  <span className="mono text-[11.5px] text-t3" dir="ltr">{m.ar.translit}</span>
                  <span className="flex-1 truncate text-[12.5px] text-t2">{ar ? pos : (m.gloss_en ?? pos)}</span>
                  <Link href={`/read?w=${encodeURIComponent(m.slug)}`} className="btn" title={t("entryTitle")} onClick={onLeave}>{t("entry")}</Link>
                </>
              ) : (
                <>
                  <span className="review-bars" aria-hidden="true"><span /><span /></span>
                  <span className="flex-1 text-[12px] text-t3">{m.pattern ? t("hint", { pattern: m.pattern.ar.full, pos }) : t("hintNoPattern", { pos })}</span>
                  <button type="button" className="btn" onClick={() => setShown(new Set([...shown, m.slug]))}>{t("reveal")}</button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn text-bad" onClick={() => onGrade("forgot")}>{t("forgot")}</button>
        <button type="button" className="btn" onClick={() => onGrade("partial")}>{t("partial")}</button>
        <button type="button" className="btn btn-primary" onClick={() => onGrade("good")}>{t("good")}</button>
      </div>
    </section>
  );
}

/** «وَٱعْلَمُوٓا۟» typed as «واعلموا» or «اعلموا»: marks and hamza seats aside, the conjunction optional. */
const same = (answer: string, surface: string) => {
  const a = normalize(answer);
  const s = normalize(surface);
  return !!a && (a === s || a === s.replace(/^[وف]/, ""));
};

/** The root in context (RDR-352…357): a verse with the family words blanked, typed, checked and graded by the
 * score. Every root has such a verse, so this card never dead-ends. */
function ContextCard({ d, onGrade }: { d: RootReview; onGrade: (g: Grade) => void }) {
  const t = useTranslations("review");
  const locale = useLocale();
  const c = d.context;
  const [answers, setAnswers] = useState<string[]>(() => c.blanks.map(() => ""));
  const [checked, setChecked] = useState(false);
  const blankAt = new Map<number, number>();
  c.blanks.forEach((b, i) => {
    for (let p = b.token_from; p <= b.token_to; p++) blankAt.set(p, i);
  });
  const right = c.blanks.map((b, i) => same(answers[i], b.surface));
  const score = right.filter(Boolean).length;
  const verdict: Grade = score === c.blanks.length ? "good" : score > 0 ? "partial" : "forgot";
  const check = () => setChecked(true);
  return (
    <section className="review-card is-wide" aria-label={d.root.spaced}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="mono text-[11.5px] text-t3" dir="ltr">{verseRef(c.verse_key, locale)}</span>
        <span className="text-[11.5px] text-t3">{locale === "ar" ? c.surah.name_ar : c.surah.name_translit}</span>
        <span className="flex-1" />
        <span className="ar-classical text-[15px] text-root" lang="ar">{t("contextCap", { root: d.root.spaced })}</span>
      </div>
      <p className="quran text-[26px] leading-[2.3]" lang="ar" dir="rtl">
        {c.tokens.map((tok, i) => {
          const b = blankAt.get(i + 1);
          if (b === undefined) return <span key={i}>{tok} </span>;
          if (c.blanks[b].token_from !== i + 1) return null; // a word over several tokens is one blank
          return (
            <span key={i} className={"review-blank" + (checked ? (right[b] ? " is-right" : " is-wrong") : "")}>
              {checked ? c.blanks[b].surface : <span className="mono text-[11px]">{formatNumber(b + 1, locale)}</span>}{" "}
            </span>
          );
        })}
      </p>
      {locale !== "ar" && c.translation && (
        <p className="text-[13px] leading-relaxed text-t2" lang="en">
          {c.translation.text}
          {c.translation_work && <span className="text-t3"> — {c.translation_work.title_en}</span>}
        </p>
      )}
      <p className="text-[12.5px] text-t3">{checked ? t("score", { score: formatNumber(score, locale), n: formatNumber(c.blanks.length, locale) }) : t("contextNote", cnt(c.blanks.length, locale))}</p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!checked) check();
        }}
      >
        {c.blanks.map((b, i) => (
          <label key={b.location} className="flex flex-wrap items-center gap-2">
            <span className="mono w-6 text-[12px] text-t3">{formatNumber(i + 1, locale)}</span>
            <input
              value={answers[i]}
              onChange={(e) => setAnswers(answers.map((a, k) => (k === i ? e.target.value : a)))}
              className="field ar-classical w-[200px] text-[20px]"
              dir="rtl"
              lang="ar"
              placeholder="…"
              aria-label={t("blank", { n: formatNumber(i + 1, locale) })}
              readOnly={checked}
              data-autofocus={i === 0 ? true : undefined}
            />
            {checked && (
              <span className={"text-[12.5px] " + (right[i] ? "text-good" : answers[i].trim() ? "text-bad" : "text-t3")}>
                {right[i] ? t("right") : answers[i].trim() ? t("wrong", { surface: b.surface }) : t("skipped", { surface: b.surface })}
              </span>
            )}
          </label>
        ))}
        {checked ? (
          <button type="button" className={"btn self-start " + (verdict === "good" ? "btn-primary" : "")} onClick={() => onGrade(verdict)}>
            {t(verdict === "good" ? "nextGood" : verdict === "partial" ? "nextPartial" : "nextForgot")}
          </button>
        ) : (
          <button type="submit" className="btn btn-primary self-start">{t("check")}</button>
        )}
      </form>
    </section>
  );
}
