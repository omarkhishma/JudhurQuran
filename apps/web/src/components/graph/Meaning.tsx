"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { create } from "zustand";
import { Icon } from "@/components/Icon";
import { ReviewMark } from "@/components/reader5/BoardMark";
import { Link } from "@/i18n/navigation";
import { cnt, formatNumber, toArabicDigits } from "@/lib/format";
import { lemmaId, link, POS_AR, rootId } from "@/lib/graph/build";
import { useEntry } from "@/lib/graph/quote";
import { KIND_COLOR, type GraphNode } from "@/lib/graph/types";
import { DICT_KIND } from "@/lib/lexica";
import { getJSON } from "@/lib/reader/api";
import { sourceLine } from "@/lib/reader/board";
import { usePrefs } from "@/lib/reader/store";
import type { BoardSource, ClassicalRow, ClassicalSource, DictWork, WordPayload } from "@/lib/reader/types";
import type { WorkSurah } from "@/lib/reader/useWorkSurah";
import type { RootDetail, Verse } from "@/lib/types";
import type { CanvasTools } from "./GraphCanvas";
import { RootRelationsList } from "./Relations";
import { TopicMeaning, VerseTopicsList } from "./Topics";

/**
 * The Meaning tab (EDT-170…181, QAN-17, QAN-18): what a card stands for, every line from a cited source and shown
 * verbatim (L2) — a root's core idea in Ibn Fāris's words with his page, its count in the Quran and the nine
 * dictionaries in the order their compilers died; a word's own meanings (al-Mufradāt on it, its sense list once the
 * board has assembled it), never its root's; a pattern as the sarf books state it; a verse's place, its plain
 * explanation or translation, and its words with their roots. An article goes onto the map as a note that quotes it
 * by its id (D22); a word's root or a verse's word, onto the map beside the card.
 */
export function Meaning({ tools, card }: { tools: CanvasTools; card: GraphNode }) {
  const d = card.data;
  if (d.kind === "root" && d.rootKey) return <RootMeaning tools={tools} card={card} rootKey={d.rootKey} />;
  if (d.kind === "lemma" && d.slug) return <LemmaMeaning tools={tools} card={card} slug={d.slug} />;
  if (d.kind === "pattern" && d.slug) return <PatternMeaning card={card} slug={d.slug} />;
  if (d.kind === "verse" && d.verse) return <VerseMeaning tools={tools} card={card} verseKey={d.verse.key} />;
  if (d.kind === "note" && d.entry) return <QuoteMeaning entry={d.entry} />;
  if (d.kind === "note" && card.id.startsWith("topic:")) return <TopicMeaning tools={tools} card={card} />;
  return <NoteMeaning card={card} tools={tools} />;
}

/** The headline as the design draws it (EDT-171, EDT-172): the Arabic large, its transliteration, a grammar line. */
function Hero({ ar, latin, grammar, gloss }: { ar: string; latin?: string | null; grammar: string; gloss?: React.ReactNode }) {
  return (
    <div className="meaning-hero">
      <p className="ar-classical text-[42px] leading-[1.35] text-t1" lang="ar" dir="rtl">{ar}</p>
      <div className="flex items-baseline justify-between gap-3">
        <span className="mono text-[12.5px] text-t3" dir="ltr">{latin || "—"}</span>
        <span className="text-end text-[12px] text-t3">{grammar}</span>
      </div>
      {gloss}
    </div>
  );
}

const Loading = () => <span className="block h-28 animate-pulse rounded-lg bg-card-2" aria-hidden="true" />;

function Failed() {
  const t = useTranslations("graph");
  return <p className="text-[12.5px] text-t3" role="status">{t("meaningUnavailable")}</p>;
}

/** The letters of a root key, counted as letters — a key kept without spaces is still three letters (HWF-50). */
const letterCount = (key: string) => [...key.replace(/\s+/g, "")].length;

function RootMeaning({ tools, card, rootKey }: { tools: CanvasTools; card: GraphNode; rootKey: string }) {
  const t = useTranslations("graph");
  const tb = useTranslations("board");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["graph-root", rootKey], queryFn: () => getJSON<RootDetail & { usul?: string | null }>(`/roots/${encodeURIComponent(rootKey)}`), staleTime: 10 * 60_000 });
  // its words on the canvas (EDT-172): the word cards of this root on the map
  const onCanvas = tools.nodes.filter((n) => n.data.kind === "lemma" && n.data.rootKey === rootKey).length;
  const n = letterCount(rootKey);
  const grammar = t("grammarRoot", { letters: t(n === 3 ? "rootLetters3" : n === 4 ? "rootLetters4" : "rootLettersN", { n: formatNumber(n, locale) }), ...cnt(onCanvas, locale) });
  return (
    <div className="flex flex-col gap-3">
      <Hero ar={card.data.ar ?? rootKey} latin={card.data.sub} grammar={grammar} />
      {q.isPending ? (
        <Loading />
      ) : !q.data ? (
        <Failed />
      ) : (
        <>
          {/* the board's English gloss, said to be the board's and on what it rests (P3.0c) */}
          {q.data.gloss_en && (
            <div>
              <p className="text-[13.5px] text-t1" dir="ltr" lang="en">{q.data.gloss_en}</p>
              <p className="text-[11px] text-t3">
                {tb("gloss")}
                {q.data.gloss_board?.sources.length ? tb("from", { works: sourceLine(q.data.gloss_board.sources, locale) }) : ""}
              </p>
            </div>
          )}
          <CoreIdea core={q.data.lexicon.core_meaning} usul={q.data.usul ?? card.data.usul ?? null} board={q.data.gist_board ? { ...q.data.gist_board, text: q.data.gist_ar } : null} />
          <RootRelationsList tools={tools} card={card} rootKey={rootKey} />
          <p className="text-[12.5px] text-t2">
            {t("inQuranCount", cnt(q.data.occurrences, locale))} {t("inVerses", cnt(q.data.verse_count, locale))} {t("inSurahsOf", cnt(q.data.surah_count, locale))} · {t("ofWords", cnt(q.data.lemma_count, locale))}
          </p>
          <Dictionaries tools={tools} card={card} works={q.data.lexicon.works as unknown as DictWork[]} root={card.data.ar ?? rootKey} />
        </>
      )}
      <Link href={`/roots/${encodeURIComponent(rootKey)}`} className="btn self-start text-[12.5px]">{t("openRoot")}</Link>
    </div>
  );
}

/** A root's core idea as Ibn Fāris words it, with his page — never our wording (L2; the design's "editorial summary"). */
function CoreIdea({ core, usul, board }: { core: RootDetail["lexicon"]["core_meaning"]; usul: string | null; board: { kept: "source" | "corrected"; text?: string | null } | null }) {
  const t = useTranslations("graph");
  const tb = useTranslations("board");
  const locale = useLocale();
  if (!core) return <p className="text-[12.5px] text-t3">{t("coreIdeaNone")}</p>;
  // where the board corrected the cut, its cut of the same article is shown, and said to be its correction
  const text = board?.kept === "corrected" && board.text ? board.text : core.text;
  return (
    <figure className="meaning-quote">
      <figcaption className="label-caps">{t("coreIdea")}</figcaption>
      <blockquote className="ar-classical text-[16px] leading-[1.9] text-t1" lang="ar" dir="rtl">«{text}»</blockquote>
      <p className="text-[11.5px] text-t3">
        {core.author_ar}، {locale === "ar" ? core.title_ar : core.title_en}
        {core.page_ref && (
          <>
            {" · "}
            <bdi dir="ltr">{core.page_ref}</bdi>
          </>
        )}
      </p>
      {board && <p className="text-[11px] text-t3">{tb(board.kept === "corrected" ? "coreCorrected" : "coreKept")}</p>}
      {(usul === "several" || usul === "unrelated") && <p className="usul-chip rounded-md bg-card-2 px-2 py-1 text-[11.5px] leading-relaxed text-t2">{t(usul === "unrelated" ? "usulUnrelatedCard" : "usulSeveralCard")}</p>}
    </figure>
  );
}

function LemmaMeaning({ tools, card, slug }: { tools: CanvasTools; card: GraphNode; slug: string }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["graph-word", slug], queryFn: () => getJSON<WordPayload>(`/words/${encodeURIComponent(slug)}?limit=0`), staleTime: 10 * 60_000 });
  const w = q.data;
  const pos = w ? (locale === "ar" ? w.pos.ar : w.pos.en) ?? w.pos.tag : (card.data.sub ?? "");
  const grammar = w?.root ? t("grammarWord", { pos, root: w.root.ar_spaced }) : w ? t("grammarWordNoRoot", { pos }) : pos;
  return (
    <div className="flex flex-col gap-3">
      <Hero
        ar={w?.ar.full ?? card.data.ar ?? ""}
        latin={w?.ar.translit}
        grammar={grammar}
        gloss={w?.gloss_en ? <p className="text-[13.5px] text-t1" dir="ltr" lang="en">{w.gloss_en} <span className="text-[11px] text-t3">— {t("corpusGloss")}</span></p> : null}
      />
      {q.isPending ? (
        <Loading />
      ) : !w ? (
        <Failed />
      ) : (
        <>
          <RootRow tools={tools} card={card} w={w} />
          <WordMeanings w={w} />
          <p className="text-[12.5px] text-t2">
            {t("inQuranCount", cnt(w.corpus_freq, locale))} · {t("inVerses", cnt(w.verse_count, locale))}
          </p>
          {w.root && <Dictionaries tools={tools} card={card} works={w.dict_articles} root={w.root.ar_spaced} />}
        </>
      )}
    </div>
  );
}

/**
 * The word's root (EDT-173): its letters and a button that selects the root's card, or adds it beside the word,
 * linked as deriving it. A particle has no root and says so (law: "no root", never a pseudo-root).
 */
function RootRow({ tools, card, w }: { tools: CanvasTools; card: GraphNode; w: WordPayload }) {
  const t = useTranslations("graph");
  if (!w.root) return <p className="text-[12.5px] text-t3">{t("noRootWord")}</p>;
  const root = w.root;
  const rid = rootId(root.key);
  const on = tools.nodes.some((n) => n.id === rid);
  const title = on ? t("rootSelect") : t("rootAdd");
  return (
    <div className="flex items-center gap-2">
      <span className="dot" style={{ background: KIND_COLOR.root }} />
      <span className="ar-classical text-[21px] tracking-[.08em] text-root" lang="ar">{root.ar_spaced}</span>
      <span className="mono text-[12px] text-t3" dir="ltr">{root.translit}</span>
      <span className="flex-1" />
      <button
        type="button"
        className="btn icon-btn h-[26px] w-[26px] min-h-0 p-0"
        title={title}
        aria-label={title}
        disabled={!on && !tools.editable}
        onClick={() =>
          tools.addLinked(
            { id: rid, type: "card", position: { x: 0, y: 0 }, data: { kind: "root", ar: root.ar_spaced, sub: root.translit, count: root.occurrences, rootKey: root.key, ...(root.gist_source?.usul ? { usul: root.gist_source.usul } : {}) } },
            link(rid, card.id, "derives"),
            card.id,
            t("doAddRoot", { root: root.ar_spaced }),
          )
        }
      >
        {on ? <Icon name="chevronEnd" size={12} /> : <Icon name="plus" size={12} />}
      </button>
    </div>
  );
}

/** A word's own meanings (QAN-17): its assembled sense list, else al-Mufradāt on it — never the root's line. */
function WordMeanings({ w }: { w: WordPayload }) {
  const t = useTranslations("graph");
  const tb = useTranslations("board");
  const locale = useLocale();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const subs = w.mufradat?.subentries ?? [];
  return (
    <section className="flex flex-col gap-2" aria-label={t("wordMeanings")}>
      <p className="label-caps">{t("wordMeanings")}</p>
      {w.senses.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {w.senses.map((s) => (
            <li key={s.id} className="flex gap-2">
              <span className="mono text-[11px] text-t3">{formatNumber(s.ordinal, locale)}</span>
              <span className="min-w-0">
                {s.text_ar && <span className="block text-[14.5px] leading-[1.8] text-t1" lang="ar" dir="rtl">{s.text_ar}</span>}
                {locale !== "ar" && s.text_en && <span className="block text-[13px] italic text-t2" lang="en" dir="ltr">{s.text_en}</span>}
                {s.status === "board" && s.sources.length > 0 && <span className="block text-[11px] text-t3" dir="auto">{sourceLine(s.sources, locale)}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {w.senses_board && <p className="text-[11px] text-t3">{tb("senses")}</p>}
      {subs.map((s) => (
        <figure key={s.id} className="meaning-quote">
          <figcaption className="text-[12px] font-medium text-t2">
            <span className="ar-classical text-[15px]" lang="ar">{s.headword_ar}</span>
          </figcaption>
          <blockquote className={"ar-classical text-[15px] leading-[1.9] text-t1" + (open[s.id] ? "" : " line-clamp-5")} lang="ar" dir="rtl">{s.text_ar}</blockquote>
          <div className="flex items-center gap-2 text-[11.5px] text-t3">
            <button type="button" className="hover:text-t1" onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))} aria-expanded={!!open[s.id]}>
              {open[s.id] ? t("showLess") : t("showMore")}
            </button>
            <span className="flex-1" />
            <span>
              {w.mufradat!.work.author_ar}، {locale === "ar" ? w.mufradat!.work.title_ar : w.mufradat!.work.title_en}
              {s.page_ref && (
                <>
                  {" · "}
                  <bdi dir="ltr">{s.page_ref}</bdi>
                </>
              )}
            </span>
          </div>
          <ReviewMark review={s.review} />
        </figure>
      ))}
      {w.senses.length === 0 && subs.length === 0 && <p className="text-[12.5px] leading-relaxed text-t3">{t("wordMeaningsPending")}</p>}
    </section>
  );
}

type DictOpen = { list: boolean; open: Record<string, boolean>; about: boolean; set: (p: Partial<Omit<DictOpen, "set">>) => void };
/** Which dictionaries are open, kept for this visit across the cards selected (EDT-179). */
const useDictOpen = create<DictOpen>()((set) => ({ list: false, open: {}, about: false, set: (p) => set(p) }));

/**
 * The dictionaries (EDT-176…180, QAN-18): the root's articles in the order their compilers died, each with its
 * label, author and date, the first two open; an entry's opening with the whole a click away, its page, the work's
 * credit, copied as text, or quoted on the map in a note beside the card (by id, never stored — D22).
 */
function Dictionaries({ tools, card, works, root }: { tools: CanvasTools; card: GraphNode; works: DictWork[]; root: string }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const { list, open, about, set } = useDictOpen();
  const sorted = [...works].sort((a, b) => (a.death_ce ?? 9999) - (b.death_ce ?? 9999));
  const isOpen = (id: string, i: number) => open[id] ?? i < 2;
  return (
    <section className="flex flex-col gap-2" aria-label={t("dictionaries")}>
      <button type="button" className="dict-pill self-start" onClick={() => set({ list: true })} title={t("dictionariesViewHint")} aria-expanded={list}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 3h8M2 6h8M2 9h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {t("dictionariesView")}
      </button>
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-t1">{t("dictionaries")}</h3>
        <button type="button" className="text-t3 hover:text-t1" onClick={() => set({ list: !list })} aria-expanded={list} title={t("dictionariesToggle")} aria-label={t("dictionariesToggle")}>
          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className={list ? "rotate-180" : ""}>
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <span className="flex-1" />
        <button type="button" className="chip text-[11px]" onClick={() => set({ about: !about })} aria-expanded={about} title={t("dictLabelsHint")}>
          {t("dictLabels")}
        </button>
      </div>
      <p className="text-[11.5px] text-t3">{t("dictionariesSub", { root })}</p>
      {about && <p className="rounded-lg bg-card-2 px-3 py-2 text-[12px] leading-relaxed text-t2">{t("dictLabelsAbout")}</p>}
      {list &&
        (sorted.length === 0 ? (
          <p className="text-[12.5px] text-t3">{t("dictionariesNone")}</p>
        ) : (
          <ul className="flex flex-col">
            {sorted.map((d, i) => {
              const k = DICT_KIND[d.id];
              const shown = isOpen(d.id, i);
              return (
                <li key={d.id} className="dict-row" data-dict={d.id}>
                  <button type="button" className="dict-row-head" onClick={() => set({ open: { ...open, [d.id]: !shown } })} aria-expanded={shown} title={t("dictEntryToggle")}>
                    <span className="ar-classical min-w-[112px] text-[20px] text-t1" lang="ar">{d.title_ar}</span>
                    {locale !== "ar" && <span className="text-[13px] font-semibold text-t1">{d.title_en}</span>}
                    <span className="flex-1" />
                    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className={"text-t3" + (shown ? " rotate-180" : "")}>
                      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                  <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-t3">
                    {locale === "ar" ? d.author_ar : d.author_en}
                    {died(d, locale, t) && <> · {died(d, locale, t)}</>}
                    {k && <span className="dict-tag">{t(`dictTag_${k.tag}`)}</span>}
                  </p>
                  {shown && d.entries.map((e) => <DictEntryBlock key={e.id} tools={tools} card={card} work={d} entry={e} />)}
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}

function died(d: { death_hijri: number | null; death_ce: number | null }, locale: string, t: ReturnType<typeof useTranslations<"graph">>): string {
  if (locale === "ar") {
    const h = d.death_hijri ? `${formatNumber(d.death_hijri, locale)}هـ` : "";
    const c = d.death_ce ? `${formatNumber(d.death_ce, locale)}م` : "";
    return h || c ? t("died", { date: [h, c].filter(Boolean).join(" / ") }) : "";
  }
  return d.death_ce ? t("died", { date: String(d.death_ce) }) : "";
}

function DictEntryBlock({ tools, card, work, entry }: { tools: CanvasTools; card: GraphNode; work: DictWork; entry: DictWork["entries"][number] }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const [whole, setWhole] = useState(false);
  const full = useEntry(whole ? entry.id : undefined);
  const ar = work.lang !== "en";
  const text = whole && full.data ? full.data.body : entry.excerpt;
  const cut = !whole && entry.length > entry.excerpt.length;
  async function copy() {
    try {
      const body = full.data?.body ?? (await getJSON<{ body: string }>(`/lexicon/entries/${entry.id}`)).body;
      await navigator.clipboard.writeText(body);
      tools.toast(t("entryCopied", { dict: locale === "ar" ? work.title_ar : work.title_en }));
    } catch {
      tools.toast(t("copyFailed"));
    }
  }
  const quoted = tools.nodes.some((n) => n.id === `quote:${entry.id}`);
  return (
    <div className="dict-entry">
      <p className={ar ? "ar-classical whitespace-pre-wrap text-[14px] leading-[2]" : "whitespace-pre-wrap text-[13px] leading-relaxed"} lang={ar ? "ar" : "en"} dir={ar ? "rtl" : "ltr"}>
        {text}
        {cut && <span className="text-t3"> …</span>}
      </p>
      <div className="flex items-center gap-1 text-[11.5px] text-t3">
        {entry.length > entry.excerpt.length && (
          <button type="button" className="hover:text-t1" onClick={() => setWhole(!whole)} aria-expanded={whole}>
            {whole ? t("showLess") : t("entryWhole", cnt(entry.length, locale))}
          </button>
        )}
        {entry.page_ref && (
          <bdi dir="ltr" className="ms-2">
            {entry.page_ref}
          </bdi>
        )}
        <span className="flex-1" />
        {tools.editable && (
          <button type="button" className="dict-act hover:text-t1" onClick={() => tools.attachQuote(card.id, entry.id)} title={quoted ? t("entryQuotedHint") : t("entryQuoteHint")} aria-label={quoted ? t("entryQuotedHint") : t("entryQuoteHint")}>
            <Icon name="plus" size={12} />
          </button>
        )}
        <button type="button" className="dict-act hover:text-t1" onClick={() => void copy()} title={t("entryCopy")} aria-label={t("entryCopy")}>
          <Icon name="copy" size={12} />
        </button>
      </div>
      <p className="text-[10.5px] leading-relaxed text-t3">
        {locale === "ar" ? work.attribution_ar : work.attribution_en}
        {!work.redistributable && <> · {t("quoteDisplayOnly")}</>}
      </p>
    </div>
  );
}

type PatternPayload = {
  slug: string;
  ar: { full: string; bare: string; translit: string };
  pos_hint: string | null;
  function_ar: string | null;
  function_en: string | null;
  function_board?: { approved_at: string | null; sources: BoardSource[] };
  plain_ar: string | null;
  plain_en: string | null;
  plain_board?: { approved_at: string | null };
  lemma_count: number;
  occurrences: number;
  classical: { rows: ClassicalRow[]; sources: ClassicalSource[] };
};

/** A pattern (وزن): what it is, how much of the Quran is on it, and what the sarf books state of it, verbatim. */
function PatternMeaning({ card, slug }: { card: GraphNode; slug: string }) {
  const t = useTranslations("graph");
  const tb = useTranslations("board");
  const locale = useLocale();
  const [all, setAll] = useState(false);
  const q = useQuery({ queryKey: ["graph-pattern", slug], queryFn: () => getJSON<PatternPayload>(`/patterns/${encodeURIComponent(slug)}`), staleTime: 10 * 60_000 });
  const p = q.data;
  const source = (id: string) => p?.classical.sources.find((s) => s.id === id);
  const rows = p?.classical.rows ?? [];
  return (
    <div className="flex flex-col gap-3">
      <Hero ar={p?.ar.full ?? card.data.ar ?? ""} latin={p?.ar.translit ?? card.data.sub} grammar={t("grammarPattern")} />
      {q.isPending ? (
        <Loading />
      ) : !p ? (
        <Failed />
      ) : (
        <>
          {(locale === "ar" ? p.function_ar : p.function_en ?? p.function_ar) && (
            <p className="text-[13.5px] leading-relaxed text-t1">
              {locale === "ar" ? p.function_ar : p.function_en ?? p.function_ar}
              {p.function_board && <span className="block text-[11px] text-t3">{tb("function")}{p.function_board.sources.length ? tb("from", { works: sourceLine(p.function_board.sources, locale) }) : ""}</span>}
            </p>
          )}
          {/* the board's own plain words on the pattern, said to be theirs (P3.0c) */}
          {(locale === "ar" ? p.plain_ar : p.plain_en ?? p.plain_ar) && (
            <p className="rounded-md bg-card-2 px-3 py-2 text-[13.5px] leading-relaxed text-t1">
              {locale === "ar" ? p.plain_ar : p.plain_en ?? p.plain_ar}
              <span className="block text-[11px] text-t3">{tb("plain")}</span>
            </p>
          )}
          <p className="text-[12.5px] text-t2">
            {t("patternWords", cnt(p.lemma_count, locale))}، {t("patternOcc", cnt(p.occurrences, locale))}
          </p>
          {rows.length > 0 && (
            <section className="flex flex-col gap-2" aria-label={t("patternBooks")}>
              <p className="label-caps">{t("patternBooks")}</p>
              {(all ? rows : rows.slice(0, 2)).map((r) => {
                const s = source(r.source_id);
                return (
                  <figure key={r.id} className="meaning-quote">
                    {r.heading_ar && <figcaption className="text-[12px] font-medium text-t2" lang="ar">{r.heading_ar}</figcaption>}
                    <blockquote className="ar-classical line-clamp-6 whitespace-pre-wrap text-[14.5px] leading-[1.9] text-t1" lang="ar" dir="rtl">{r.text_ar}</blockquote>
                    {s && <p className="text-[11.5px] text-t3">{locale === "ar" ? `${s.author_ar}، ${s.title_ar}` : `${s.author_en}, ${s.title_en}`}</p>}
                    <ReviewMark review={r.review} />
                  </figure>
                );
              })}
              {rows.length > 2 && (
                <button type="button" className="self-start text-[12px] text-t3 hover:text-t1" onClick={() => setAll(!all)} aria-expanded={all}>
                  {all ? t("showLess") : t("patternBooksMore", cnt(rows.length - 2, locale))}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

type SurahRow = { number: number; name_ar: string; name_translit: string; revelation_place: string; verse_count: number };

/**
 * A verse (QAN-17): its place — sūra, Makki or Madani, how many verses the sūra has — its plain explanation
 * (al-Muyassar, in Arabic) or its translation (the reader's chosen one, in English), credited, and its words with
 * their roots, each a way to its card or onto the map beside the verse, marked at its place.
 */
function VerseMeaning({ tools, card, verseKey }: { tools: CanvasTools; card: GraphNode; verseKey: string }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const translation = usePrefs((s) => s.translation);
  const [surah, ayah] = verseKey.split(":").map(Number);
  const v = useQuery({ queryKey: ["graph-verse", verseKey], queryFn: () => getJSON<Verse>(`/verses/${verseKey}`), staleTime: Infinity });
  const surahs = useQuery({ queryKey: ["graph-surahs"], queryFn: () => getJSON<{ data: SurahRow[] }>("/surahs"), staleTime: Infinity });
  const work = locale === "ar" ? "muyassar" : translation;
  const ex = useQuery({ queryKey: ["work-surah", work, surah], queryFn: () => getJSON<WorkSurah>(`/works/${encodeURIComponent(work)}/surahs/${surah}`), staleTime: Infinity });
  const s = surahs.data?.data.find((x) => x.number === surah);
  const passage = ex.data?.passages.find((p) => p.from_surah === surah && p.from_ayah <= ayah && (p.to_surah === surah ? p.to_ayah : p.from_ayah) >= ayah);
  const head = s ? (locale === "ar" ? `${s.name_ar}: ${formatNumber(ayah, locale)}` : `${s.name_translit} ${verseKey}`) : locale === "ar" ? toArabicDigits(verseKey) : verseKey;
  const grammar = s ? t("grammarVerse", { place: t(s.revelation_place === "medinan" ? "medinan" : "meccan"), ...cnt(s.verse_count, locale) }) : t("kindVerse");
  return (
    <div className="flex flex-col gap-3">
      <div className="meaning-hero">
        <p className="ar-classical text-[28px] leading-[1.4] text-t1" lang="ar">{head}</p>
        <p className="text-[12px] text-t3">{grammar}</p>
      </div>
      {ex.isPending ? null : passage ? (
        <figure className="meaning-quote">
          <figcaption className="label-caps">{t(locale === "ar" ? "verseExplanation" : "verseTranslation")}</figcaption>
          <blockquote className={locale === "ar" ? "text-[14.5px] leading-[1.9] text-t1" : "text-[13.5px] leading-relaxed text-t1"} lang={locale === "ar" ? "ar" : "en"} dir={locale === "ar" ? "rtl" : "ltr"}>
            {passage.text}
          </blockquote>
          <p className="text-[11px] leading-relaxed text-t3">{locale === "ar" ? ex.data!.work.attribution_ar : ex.data!.work.attribution_en}</p>
        </figure>
      ) : null}
      <VerseTopicsList tools={tools} card={card} verseKey={verseKey} />
      {v.isPending ? (
        <Loading />
      ) : !v.data ? (
        <Failed />
      ) : (
        <section className="flex flex-col gap-1" aria-label={t("verseWords")}>
          <p className="label-caps">{t("verseWords")}</p>
          <ul className="flex flex-col">
            {v.data.words.map((w) => {
              const id = w.lemma_slug ? lemmaId(w.lemma_slug) : null;
              const on = !!id && tools.nodes.some((n) => n.id === id);
              return (
                <li key={w.location} className="verse-word-row">
                  <span className="quran text-[19px] text-t1" lang="ar">{w.text_uthmani}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-t3">
                    {w.lemma && <span className="ar-classical text-[14px] text-word" lang="ar">{w.lemma}</span>}
                    {" · "}
                    {w.root ? <span className="ar-classical text-[14px] text-root" lang="ar">{w.root.split("").join(" ")}</span> : t("noRoot")}
                  </span>
                  {id && (
                    <button
                      type="button"
                      className="btn icon-btn h-[26px] w-[26px] min-h-0 p-0"
                      title={on ? t("wordSelect") : t("wordAdd")}
                      aria-label={(on ? t("wordSelect") : t("wordAdd")) + ` ${w.text_uthmani}`}
                      disabled={!on && !tools.editable}
                      onClick={() =>
                        tools.addLinked(
                          { id: id!, type: "card", position: { x: 0, y: 0 }, data: { kind: "lemma", slug: w.lemma_slug!, ar: w.lemma ?? w.text_imlaei, sub: POS_AR[w.pos] ?? w.pos, ...(w.root ? { rootKey: w.root } : {}), first: w.location } },
                          link(id!, card.id, "attests", { place: w.location }),
                          card.id,
                          t("doAddWord", { word: w.lemma ?? w.text_imlaei }),
                          { verse: card.id, place: w.location },
                        )
                      }
                    >
                      {on ? <Icon name="chevronEnd" size={12} /> : <Icon name="plus" size={12} />}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <Link href={`/quran/${surah}/${ayah}`} className="btn self-start text-[12.5px]">{t("openReader")}</Link>
    </div>
  );
}

/** A quoted article in full, with its work's credit as the reader gives it, and the way to its root (RDR-239). */
export function QuoteMeaning({ entry }: { entry: number }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const e = useEntry(entry);
  if (e.isPending) return <Loading />;
  if (!e.data) return <p className="text-[12.5px] text-t3">{t("quoteUnavailable")}</p>;
  const ar = e.data.lang !== "en";
  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-[12.5px] font-medium text-t1">
        {locale === "ar" ? `${e.data.title_ar} — ${e.data.author_ar}` : `${e.data.title_en} — ${e.data.author_en}`}
        {e.data.page_ref && (
          <span className="text-t3">
            {" · "}
            <bdi dir="ltr" className="whitespace-nowrap">{e.data.page_ref}</bdi>
          </span>
        )}
      </figcaption>
      <blockquote className={"quote-full " + (ar ? "ar-classical text-[16px] leading-[2]" : "text-[13px] leading-relaxed")} lang={ar ? "ar" : "en"} dir={ar ? "rtl" : "ltr"} tabIndex={0}>
        {e.data.body}
      </blockquote>
      <p className="text-[11px] leading-relaxed text-t3">
        {locale === "ar" ? e.data.attribution_ar : e.data.attribution_en}
        {!e.data.redistributable && <> · {t("quoteDisplayOnly")}</>}
      </p>
      <Link href={`/roots/${encodeURIComponent(e.data.root_key)}`} className="btn self-start text-[12.5px]">{t("openRoot")}</Link>
    </figure>
  );
}

/** The reader's own note, or a phrase they analysed: their words, said to be theirs (EDT-172's "editorial note"). */
/** A field's card (P8.4c): the chapter as the book titles it, and the members put in it on this map — each link
 * carrying the book's sentence for its word. */
function FieldMeaning({ card, tools }: { card: GraphNode; tools: CanvasTools }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const members = tools.edges.filter((e) => e.target === card.id && e.data?.rel === "field-member");
  const unreviewed = members.some((e) => e.data?.relation && !e.data.reviewed);
  return (
    <div className="flex flex-col gap-2">
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-t1" dir="auto">{card.data.text}</p>
      <p className="text-[12px] text-t3">{t("fieldCard")}</p>
      <p className="text-[12.5px] text-t2">{t("fieldMembers", cnt(members.length, locale))}</p>
      <ul className="flex flex-wrap gap-1.5">
        {members.map((e) => (
          <li key={e.id}>
            <button type="button" className="chip" onClick={() => { tools.select(e.source); tools.center(e.source); }}>
              <span lang="ar">{tools.cardName(e.source)}</span>
            </button>
          </li>
        ))}
      </ul>
      {unreviewed && <p className="text-[11.5px] leading-relaxed text-amber">{t("fieldUnreviewed")}</p>}
    </div>
  );
}

function NoteMeaning({ card, tools }: { card: GraphNode; tools?: CanvasTools }) {
  const t = useTranslations("graph");
  const d = card.data;
  if (card.id.startsWith("field:") && tools) return <FieldMeaning card={card} tools={tools} />;
  return (
    <div className="flex flex-col gap-2">
      <p className={"whitespace-pre-wrap text-t1 " + (d.phrase ? "ar-classical text-[22px] leading-[1.6]" : "text-[15px] leading-relaxed")} dir="auto">{d.text || t("noteEmpty")}</p>
      <p className="text-[12px] text-t3">{t(d.phrase ? "grammarPhrase" : "personalNote")}</p>
      <p className="text-[12px] leading-relaxed text-t3">{t("noteNoChildren")}</p>
    </div>
  );
}
