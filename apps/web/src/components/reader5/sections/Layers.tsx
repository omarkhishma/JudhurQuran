"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Term } from "@/components/terms/Term";
import { Link } from "@/i18n/navigation";
import { authFetch, useAccount } from "@/lib/account/store";
import { encodeSeed } from "@/lib/graph/seedCodec";
import type { VerseTopic, VerseTopics } from "@/lib/graph/topics";
import { cnt, cnt2, formatNumber, verseRef } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { LayerId } from "@/lib/reader/layers";
import { useReader } from "@/lib/reader/store";
import type { DefinedLink, TcLayers, WordContext, WordPayload } from "@/lib/reader/types";
import { SourceTopics } from "../SourceTopics";
import { useWordRelations } from "./Wujuh";

/** One layer of a word's meaning (P15, D30): its name, dotted for its plain-language card, a line of what it holds,
 * and its body when open. A door from the data card opens it and brings it into view. */
export function MeaningLayer({ id, label, term, summary, open, onToggle, children }: { id: LayerId; label: string; term: string | null; summary?: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="meaning-layer" id={`layer-${id}`} data-layer={id}>
      <button type="button" className="meaning-layer-head" aria-expanded={open} onClick={onToggle}>
        <span className="text-[13px] font-semibold text-t1">{term ? <Term id={term as never}>{label}</Term> : label}</span>
        {summary && <span className="min-w-0 flex-1 truncate text-[11.5px] text-t3">{summary}</span>}
        <span className="layer-chev" aria-hidden="true">▾</span>
      </button>
      {open && <div className="meaning-layer-body">{children}</div>}
    </section>
  );
}

/** Where a reader of the board or the administration goes to set this, and comes back to — by the role the server
 * holds now, not the one stored at sign-in (a role given since shows at once, as in the workbench). */
function useBoardLink() {
  const session = useAccount((s) => s.session);
  const me = useQuery({ queryKey: ["me-role", session], queryFn: () => authFetch<{ role: string }>("/me"), enabled: !!session, staleTime: 60_000, retry: false });
  const role = me.data?.role;
  const board = role === "admin" || role === "editor";
  const back = () => {
    if (typeof window === "undefined") return "";
    const path = window.location.pathname.replace(/^\/en(?=\/|$)/, "") || "/";
    return path + window.location.search;
  };
  return { board, href: (kind: string, target: string) => `/workbench?kind=${kind}&target=${encodeURIComponent(target)}&back=${encodeURIComponent(back())}` };
}

export function useWordContext(location: string | null) {
  return useQuery({ queryKey: ["word-context", location], queryFn: () => getJSON<WordContext>(`/words/${location}/context`), enabled: !!location, staleTime: 10 * 60_000 });
}

/** Who set a context or a link, and whether the board has reviewed it, in the reader's words (D31). */
function ByLine({ by, reviewed }: { by: "administration" | "board"; reviewed: boolean }) {
  const t = useTranslations("rd");
  return <span>{by === "administration" ? `${t("ctxByAdministration")} • ${t(reviewed ? "ctxReviewed" : "ctxNotReviewed")}` : t("ctxByBoard")}</span>;
}

/** The verse as the mushaf writes it, word by word: this word marked, and its root's other words in the context. */
function ContextVerse({ v, word, rooted }: { v: WordContext["verses"][number]; word: { verse_id: number; from: number; to: number } | null; rooted: Map<number, { from: number; to: number }[]> }) {
  const locale = useLocale();
  const end = v.text_qpc.slice(v.text_qpc.lastIndexOf(" ") + 1);
  const marks = rooted.get(v.id) ?? [];
  return (
    <li className="ctx-verse">
      <p className="quran text-[20px] leading-[2.15] text-t1" lang="ar" dir="rtl">
        {v.tokens.map((tk) => {
          const here = word && word.verse_id === v.id && tk.position >= word.from && tk.position <= word.to;
          const kin = !here && marks.some((m) => tk.position >= m.from && tk.position <= m.to);
          return (
            <span key={tk.position} className={here ? "ctx-word" : kin ? "ctx-kin" : undefined}>
              {tk.text}{" "}
            </span>
          );
        })}
        {end}
      </p>
      <span className="mono text-[10.5px] text-t3">{verseRef(v.key, locale)}</span>
    </li>
  );
}

/**
 * The contextual layer (P15.3, PV-03, PV-05): the run of verses the word's meaning is read in — set by the
 * administration (its own range, or its sūra's passage), said who set it and whether the board reviewed it, with what
 * the word means there where the administration wrote it on a source — or, until one is set, said so, with how the
 * commentators group the verses around it; the verses as the mushaf writes them with the word and its root's other
 * words marked; then what the sources say it means in this very place, each credited; and the sense the wujūh books
 * give this verse.
 */
export function ContextualLayer({ w, here }: { w: WordPayload; here: ReactNode }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const occ = w.occurrence;
  const ctx = useWordContext(occ?.location ?? null);
  const rel = useWordRelations(w.slug, occ?.location ?? null);
  const link = useBoardLink();
  if (!occ) return <p className="text-[12.5px] text-t3">{t("ctxNeedsPlace")}</p>;
  const c = ctx.data?.context ?? null;
  const rooted = new Map<number, { from: number; to: number }[]>();
  for (const r of ctx.data?.same_root ?? []) rooted.set(r.verse_id, [...(rooted.get(r.verse_id) ?? []), { from: r.token_from, to: r.token_to }]);
  const word = ctx.data ? { verse_id: ctx.data.word.verse_id, from: occ.token_from, to: occ.token_to } : null;
  const citesHere = (rel.data?.wujuh ?? []).flatMap((e) => e.senses.filter((s) => s.cites_here).map((s) => ({ e, s })));
  const short = (id: string) => (t.has(`srcShort.${id}`) ? t(`srcShort.${id}`) : id);
  const [s, a] = (c?.from ?? occ.verse_key).split(":");
  return (
    <div className="flex flex-col gap-3">
      {ctx.isPending ? (
        <span className="block h-20 animate-pulse rounded-lg bg-card-2" aria-hidden="true" />
      ) : c ? (
        <div className="ctx-box">
          <p className="text-[13px] text-t1">
            {t("ctxRange", { from: verseRef(c.from, locale), to: verseRef(c.to, locale), ...cnt(c.verses, locale) })}
            {c.level === "passage" && (locale === "ar" ? c.title_ar : c.title_en) && <span className="text-t2">{` — ${locale === "ar" ? c.title_ar : c.title_en}`}</span>}
          </p>
          <p className="text-[11px] text-t3">
            {t(c.level === "word" ? "ctxOwn" : "ctxPassage")} • <ByLine by={c.by} reviewed={c.reviewed} />
          </p>
          {c.statement && (c.statement.meaning_ar || c.statement.meaning_en) && (
            <div className="flex flex-col gap-1">
              {c.statement.meaning_ar && <p className="text-[15px] leading-[1.9] text-t1" lang="ar" dir="rtl">{c.statement.meaning_ar}</p>}
              {c.statement.meaning_en && locale === "en" && <p className="text-[13.5px] leading-relaxed text-t1" lang="en" dir="ltr">{c.statement.meaning_en}</p>}
              <p className="text-[11px] text-t3" dir="auto">
                {t("ctxStatementBy")}
                {c.sources.length > 0 && ` — ${t("ctxRestsOn")} ${c.sources.map((x) => [x.work, x.ref].filter(Boolean).join(" ")).join("؛ ")}`}
              </p>
            </div>
          )}
          {c.statement?.note_ar && <p className="text-[12px] text-t2" dir="auto">{c.statement.note_ar}</p>}
        </div>
      ) : (
        <div className="ctx-box is-unset">
          <p className="text-[12.5px] text-t2">{t("ctxUnset")}</p>
          {(ctx.data?.groupings.length ?? 0) > 0 && (
            <>
              <p className="text-[11.5px] text-t3">{t("ctxGroupingsLead")}</p>
              <ul className="flex flex-col gap-1">
                {ctx.data!.groupings.slice(0, 4).map((g) => (
                  <li key={`${g.from_id}-${g.to_id}`} className="text-[12.5px] text-t2">
                    {t("ctxRange", { from: verseRef(g.from, locale), to: verseRef(g.to, locale), ...cnt(g.verses, locale) })}
                    <span className="text-[11px] text-t3"> — {g.sources.map((x) => (x.kind === "topic" ? x.title_ar : short(x.source))).join("، ")}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {link.board && (
        <Link href={link.href("context_word", occ.location)} className="btn self-start text-[12px]">
          {t("ctxSet")}
        </Link>
      )}
      {ctx.data && ctx.data.verses.length > 0 && (
        <ol className="flex flex-col gap-1" aria-label={t("ctxVerses")}>
          {ctx.data.verses.map((v) => (
            <ContextVerse key={v.id} v={v} word={word} rooted={rooted} />
          ))}
        </ol>
      )}
      {(ctx.data?.verses_more ?? 0) > 0 && (
        <Link href={`/quran/${s}/${a}`} className="text-door self-start text-[12px] text-word underline-offset-2 hover:underline">
          {t("ctxReadAll", cnt(ctx.data!.verses_more, locale))}
        </Link>
      )}
      {(ctx.data?.same_root.length ?? 0) > 0 && <p className="text-[11.5px] text-t3">{t("ctxKin", cnt(ctx.data!.same_root.length, locale))}</p>}

      {here}
      {citesHere.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="label-caps">{t("ctxWujuhHere")}</p>
          {citesHere.map(({ e, s: sense }) => (
            <p key={sense.id} className="text-[13.5px] text-t1" lang="ar" dir="rtl">
              <strong className="ar-classical font-bold">{sense.sense_label_ar ?? e.heading_ar}</strong>
              <span className="text-[11px] text-t3"> — {rel.data?.sources[e.source_id]?.title_ar}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** The Tafsir Center's credit under its words. */
export function TcCredit({ tc }: { tc: TcLayers }) {
  const locale = useLocale();
  if (!tc.source) return null;
  return (
    <p className="text-[11px] text-t3">
      <a href={tc.source.url} target="_blank" rel="noreferrer" className="hover:underline">{locale === "ar" ? tc.source.attribution_ar : tc.source.attribution_en}</a>
    </p>
  );
}

/**
 * The words the administration or the board set beside this one (P15.4, PV-22, PV-23): near in meaning, related,
 * and opposite — each a chip that opens the word, with its root and count and the note on the difference; who set it.
 */
export function DefinedRelations({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const openWord = useReader((s) => s.openWord);
  const rel = useWordRelations(w.slug, w.occurrence?.location ?? null);
  const link = useBoardLink();
  const d = rel.data?.defined;
  const groups: ["near" | "related" | "opposite", DefinedLink[]][] = d ? [["near", d.near], ["related", d.related], ["opposite", d.opposite]] : [];
  const any = groups.some(([, xs]) => xs.length > 0);
  return (
    <div className="flex flex-col gap-2">
      {!any ? (
        <p className="text-[12.5px] text-t3">{rel.isPending ? "" : t("relNoneYet")}</p>
      ) : (
        groups
          .filter(([, xs]) => xs.length > 0)
          .map(([r, xs]) => (
            <div key={r} className="flex flex-col gap-1.5">
              <p className="label-caps">{t(`rel_${r}`)}</p>
              <ul className="flex flex-wrap gap-1.5">
                {xs.map((x) => (
                  <li key={x.slug}>
                    <button type="button" className="word-chip" onClick={() => openWord({ slug: x.slug, at: null })} title={x.note_ar || undefined}>
                      <span className="ar-classical text-[18px] leading-[1.6]" lang="ar" dir="rtl">{x.word.ar}</span>
                      {x.word.root_spaced && <span className="text-[10.5px] text-t3" lang="ar">{x.word.root_spaced}</span>}
                      <span className="mono text-[10.5px] text-t3">{formatNumber(x.word.occurrences, locale)}</span>
                    </button>
                    {x.note_ar && <p className="mt-0.5 max-w-[260px] text-[11.5px] text-t2" lang="ar" dir="rtl">{x.note_ar}</p>}
                  </li>
                ))}
              </ul>
              <p className="text-[10.5px] text-t3">
                <ByLine by={xs[0].by} reviewed={xs.every((x) => x.reviewed)} />
              </p>
            </div>
          ))
      )}
      {link.board && (
        <Link href={link.href("word_relations", w.slug)} className="btn self-start text-[12px]">
          {t("relSet")}
        </Link>
      )}
    </div>
  );
}

type WordTopics = { slug: string; here: VerseTopics | null; recurring: (VerseTopic & { word_verses: number })[]; sources: VerseTopics["sources"] };

export function useWordTopics(slug: string, at: string | null) {
  return useQuery({ queryKey: ["word-topics", slug, at], queryFn: () => getJSON<WordTopics>(`/words/${encodeURIComponent(slug)}/topics${at ? `?at=${at}` : ""}`), staleTime: 10 * 60_000 });
}

/** The word's topics (P15.4, PV-21): its verse's, and those whose verses hold it most, Quranpedia credited. */
export function WordTopicsBlock({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const q = useWordTopics(w.slug, w.occurrence?.location ?? null);
  if (!q.data) return q.isPending ? <span className="block h-12 animate-pulse rounded-lg bg-card-2" aria-hidden="true" /> : null;
  const d = q.data;
  return (
    <div className="flex flex-col gap-2">
      <p className="label-caps">{t("topicsOfWord")}</p>
      {d.recurring.length === 0 ? (
        <p className="text-[12.5px] text-t3">{t("topicsWordNone")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {d.recurring.map((x) => (
            <li key={x.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[13.5px] text-t1" lang="ar">{x.name}</span>
              {x.parent_name && <span className="text-[11px] text-t3" lang="ar">{x.parent_name}</span>}
              <span className="text-[11px] text-t3">{t("topicWordVerses", cnt(x.word_verses, locale))}</span>
              <Link href={`/graph/seed?s=${encodeSeed({ seed: "topic", topic: x.id })}`} className="text-[11.5px] text-word hover:underline">
                {t("topicMap")}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {d.here && (
        <>
          <p className="label-caps mt-1">{t("topicsOfVerse", { ref: verseRef(d.here.verse_key, locale) })}</p>
          <SourceTopics data={d.here} />
        </>
      )}
      {!d.here && d.recurring.length > 0 && <SourceTopics data={{ verse_key: "", data: [], sources: d.sources }} />}
    </div>
  );
}

/** How a word's pattern was found (DECISIONS 2026-10-02, wazn), in the reader's words. */
const METHOD: Record<string, "waznByTag" | "waznByForm" | "waznByFormI" | "waznByMatch"> = { tag: "waznByTag", "verb-form": "waznByForm", "verb-form-I": "waznByFormI", match: "waznByMatch" };

/** The morphological layer (P15.5, PV-24): the wazn, how it was found, what the sarf books say it does; the Tafsir
 * Center's sarf statement of this word beside it; the whole pattern one tap away. */
export function MorphologicalLayer({ w, fn }: { w: WordPayload; fn: ReactNode }) {
  const t = useTranslations("rd");
  const jumpTo = useReader((s) => s.jumpTo);
  const tc = w.occurrence?.tc;
  return (
    <div className="flex flex-col gap-2.5">
      {w.pattern ? (
        <div className="flex flex-col gap-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="ar-classical text-[22px] text-t1" lang="ar">{w.pattern.ar.full}</span>
            <span className="mono text-[11px] text-t3" dir="ltr">{w.pattern.ar.translit}</span>
            {w.pattern.method && METHOD[w.pattern.method] && <span className="text-[11px] text-t3">{t(METHOD[w.pattern.method])}</span>}
          </p>
          <p className="text-[13.5px] leading-relaxed text-t2">{fn}</p>
          <button type="button" className="text-door self-start text-[12px] text-word underline-offset-2 hover:underline" onClick={() => jumpTo("patterns")}>
            {t("showShapes")}
          </button>
        </div>
      ) : (
        <p className="text-[12.5px] text-t3">{t("waznNone")}</p>
      )}
      {tc && tc.sarf.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="label-caps">{t("sarfHere")}</p>
          {tc.sarf.map((s, i) => (
            <p key={i} className="text-[14.5px] leading-[1.95] text-t1" lang="ar" dir="rtl">{s}</p>
          ))}
          <TcCredit tc={tc} />
        </div>
      )}
    </div>
  );
}

/** The Tafsir Center's iʿrāb of this word, and of its whole verse on request (P15.5). */
export function IrabBlock({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const tc = w.occurrence?.tc;
  const [open, setOpen] = useState(false);
  const key = w.occurrence?.verse_key ?? null;
  const verse = useQuery({ queryKey: ["verse-irab", key], queryFn: () => getJSON<{ text: string }>(`/verses/${key}/irab`), enabled: open && !!key, staleTime: Infinity });
  if (!tc || tc.irab.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="label-caps">{t("irabHere")}</p>
      {tc.irab.map((s, i) => (
        <p key={i} className="text-[14.5px] leading-[1.95] text-t1" lang="ar" dir="rtl">{s}</p>
      ))}
      <button type="button" className="text-door self-start text-[12px] text-word underline-offset-2 hover:underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {t(open ? "irabVerseHide" : "irabVerse")}
      </button>
      {open && (verse.data ? <p className="whitespace-pre-line rounded-lg bg-card-2 p-2.5 text-[14px] leading-[1.95] text-t1" lang="ar" dir="rtl">{verse.data.text}</p> : <span className="block h-16 animate-pulse rounded-lg bg-card-2" aria-hidden="true" />)}
      <TcCredit tc={tc} />
    </div>
  );
}

/** The readers' difference on this word (P15.5): who reads what, alone and joined to the next word, and what the
 * difference means — or the Center's word that they do not differ; and its note on the spelling. */
export function ReadingsLayer({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const tc = w.occurrence?.tc;
  if (!tc) return <p className="text-[12.5px] text-t3">{t("ctxNeedsPlace")}</p>;
  const list = (r: { same: boolean; items: { readers: string; reading: string }[] }) =>
    r.same ? (
      <p className="text-[13px] text-t2">{t("readingsSame")}</p>
    ) : (
      <ul className="flex flex-col gap-1">
        {r.items.map((x, i) => (
          <li key={i} className="text-[13.5px] leading-[1.8]" lang="ar" dir="rtl">
            {x.readers && <strong className="font-semibold text-t1">{x.readers}: </strong>}
            <span className="text-t2">{x.reading}</span>
          </li>
        ))}
      </ul>
    );
  return (
    <div className="flex flex-col gap-2">
      <p className="label-caps">{t("readingsTitle")}</p>
      {tc.qiraat_same ? (
        <p className="text-[13px] text-t2">{t("readingsSame")}</p>
      ) : (
        tc.qiraat.map((q, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <p className="text-[11.5px] text-t3">{t("readingsAlone")}</p>
            {list(q.alone)}
            {q.joined && (
              <>
                <p className="text-[11.5px] text-t3">{t("readingsJoined")}</p>
                {list(q.joined)}
              </>
            )}
          </div>
        ))
      )}
      {tc.qiraat_note.map((n, i) => (
        <p key={i} className="rounded-lg bg-card-2 px-2.5 py-1.5 text-[13px] leading-[1.8] text-t2" lang="ar" dir="rtl">{n}</p>
      ))}
      {tc.rasm.length > 0 && (
        <>
          <p className="label-caps mt-1">{t("rasmTitle")}</p>
          {tc.rasm.map((r, i) => (
            <p key={i} className="text-[13.5px] leading-[1.8] text-t2" lang="ar" dir="rtl">{r}</p>
          ))}
        </>
      )}
      <TcCredit tc={tc} />
    </div>
  );
}

/** Bring a layer the data card opened into view, once the panel has drawn it. */
export function useLayerFocus(onOpen: (id: LayerId) => void) {
  const focus = useReader((s) => s.meaningLayer);
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!focus || done.current === focus) return;
    done.current = focus;
    onOpen(focus);
    const id = setTimeout(() => {
      document.getElementById(`layer-${focus}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
      useReader.getState().focusLayer(null);
      done.current = null;
    }, 260);
    return () => clearTimeout(id);
  }, [focus, onOpen]);
}

/**
 * The word's data at a glance (P15.1, PV-18…PV-24): how often it occurs and where, its root's count, its pattern and
 * what it does, its context, the near and opposite words set for it and the topics it gathers under — each a door to
 * the layer or the section that holds it. Every number is the data's, counted on the server.
 */
export function WordDataCard({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const jumpTo = useReader((s) => s.jumpTo);
  const focusLayer = useReader((s) => s.focusLayer);
  const ctx = useWordContext(w.occurrence?.location ?? null);
  const rel = useWordRelations(w.slug, w.occurrence?.location ?? null);
  const topics = useWordTopics(w.slug, w.occurrence?.location ?? null);
  const a = w.attestations;
  const d = rel.data?.defined;
  const near = d ? d.near.length + d.related.length : 0;
  const opposite = d ? d.opposite.length : 0;
  const c = ctx.data?.context;
  const row = (label: string, value: ReactNode, go: () => void, key: string) => (
    <div key={key} className="data-row">
      <dt className="text-[11.5px] text-t3">{label}</dt>
      <dd className="min-w-0">
        <button type="button" className="data-door" onClick={go}>
          {value}
        </button>
      </dd>
    </div>
  );
  return (
    <dl className="data-card" aria-label={t("dataCard")}>
      {row(t("dataFrequency"), t("dataFrequencyValue", { ...cnt(w.corpus_freq, locale), ...cnt2(w.verse_count, locale), count3: a.by_chapter.length, n3: formatNumber(a.by_chapter.length, locale), meccan: formatNumber(a.meccan, locale), medinan: formatNumber(a.medinan, locale) }), () => jumpTo("usage"), "freq")}
      {w.root && row(t("dataRoot"), t("dataRootValue", { root: w.root.ar_spaced, ...cnt(w.root.occurrences, locale), ...cnt2(w.root.lemma_count, locale) }), () => jumpTo("family"), "root")}
      {w.pattern && row(t("dataPattern"), <span className="ar-classical text-[15px]" lang="ar">{w.pattern.ar.full}</span>, () => focusLayer("morphological"), "pattern")}
      {w.occurrence &&
        row(
          t("dataContext"),
          ctx.isPending ? "…" : c ? t("dataContextValue", { from: verseRef(c.from, locale), to: verseRef(c.to, locale) }) : t("dataContextUnset"),
          () => focusLayer("contextual"),
          "ctx",
        )}
      {row(t("dataRelations"), rel.isPending ? "…" : t("dataRelationsValue", { near: formatNumber(near, locale), opposite: formatNumber(opposite, locale) }), () => focusLayer("semantic"), "rel")}
      {row(t("dataTopics"), topics.isPending ? "…" : t("dataTopicsValue", cnt(topics.data?.recurring.length ?? 0, locale)), () => focusLayer("semantic"), "topics")}
    </dl>
  );
}
