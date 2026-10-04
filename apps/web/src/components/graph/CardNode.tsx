"use client";

import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, memo, useContext, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { citeVerse, cnt, formatNumber } from "@/lib/format";
import { META } from "@/lib/graph/relations";
import { FIELD_KINDS, KIND_COLOR, type Field, type FieldKind, type GraphNode } from "@/lib/graph/types";
import { useQuery } from "@tanstack/react-query";
import type { ExtractOptions, VerseWord } from "@/lib/graph/extract";
import { getJSON } from "@/lib/reader/api";
import { useAudio } from "@/lib/store/audio";
import type { CardStats } from "./GraphCanvas";
import { CommentMarker } from "./Comments";
import { isBoardTopic, sourceHeading, topicOf } from "@/lib/graph/topics";
import { FieldEditor } from "./FieldEditor";
import { opening, useEntry } from "@/lib/graph/quote";
import { excerptOf, keyOf, markedVerse, useVerseText } from "@/lib/graph/verseText";

export type GraphActions = {
  editable: boolean;
  /** transliteration shown on the cards (QAN-22) */
  translit: boolean;
  /** zoomed out below the map threshold: each card shows only its headline, large (EDT-058, QAN-20) */
  mapView: boolean;
  /** the card whose places are being read */
  expanding: string | null;
  toggleFold: (id: string) => void;
  expand: (id: string, opts?: ExtractOptions) => void;
  setText: (id: string, text: string) => void;
  addField: (id: string, kind: FieldKind) => void;
  editField: (id: string, field: string, value: Field["value"], fileName?: string) => void;
  removeField: (id: string, field: string) => void;
  attach: (id: string) => void;
  focusCard: (id: string) => void;
  /** a card's place in the map and what it has left to extract (EDT-090, EDT-091) */
  stats: (id: string) => CardStats;
  /** what a verse can still link, its words and their roots (EDT-123) */
  versePlan: (id: string, words: VerseWord[], particles: boolean) => { words: VerseWord[]; roots: string[] };
  toast: (text: string) => void;
  /** the map takes meaning relations between roots, and a root's related roots are added (P8.4) */
  relations: boolean;
  relate: (id: string) => void;
  /** a topic card's next ten verses (P8.3) */
  topicVerses: (id: string) => void;
};

export const GraphActionsContext = createContext<GraphActions>({
  editable: false,
  translit: false,
  mapView: false,
  expanding: null,
  toggleFold: () => {},
  expand: () => {},
  setText: () => {},
  addField: () => {},
  editField: () => {},
  removeField: () => {},
  attach: () => {},
  focusCard: () => {},
  stats: () => ({ a: 0, b: 0, left: null }),
  versePlan: () => ({ words: [], roots: [] }),
  toast: () => {},
  relations: false,
  relate: () => {},
  topicVerses: () => {},
});

/**
 * One card anatomy for every kind (handoff §4.2, EDT-083…101): type dot + kind label + count on top, the Arabic line
 * as the largest element; folded, one line under it (248 px); open, its secondary line, what the kind holds, its
 * place in the map, the reader's fields and the card's actions (344 px). The colour is the type (QAN-01). Links
 * enter on the right and leave on the left — the graph reads right to left, like the text.
 */
function CardNodeImpl({ id, data, selected }: NodeProps<GraphNode>) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const actions = useContext(GraphActionsContext);
  const color = KIND_COLOR[data.kind];
  const [draft, setDraft] = useState(data.text ?? "");
  const meta = META[data.kind];
  // a topic's, a field's or a proper name's heading card: the source's words, not the reader's (P8.3, P8.4c, P8.3b)
  const heading = data.kind === "note" ? sourceHeading(id) : null;
  const headingKind = heading === "topic" ? "kindTopic" : heading === "field" ? "kindField" : heading === "entity" ? "kindEntity" : null;
  // whose a heading is: Quranpedia's index, the editorial board's taxonomy, the books of fields, the corpus's names
  const headingFrom = heading === "topic" ? (isBoardTopic(topicOf(id) ?? "") ? "topicCardBoard" : "topicCardFrom") : heading === "field" ? "fieldCardFrom" : heading === "entity" ? "entityCardFrom" : "personalNote";
  const translitLine = actions.translit || (data.kind !== "root" && data.kind !== "pattern");
  const summary = data.kind === "lemma" ? data.sub : (data.kind === "root" || data.kind === "pattern") && actions.translit ? data.sub : undefined;

  return (
    <div
      className={
        "graph-card rounded-[18px] border bg-card text-start " +
        (data.folded ? "is-folded " : "is-open ") +
        (selected ? "outline-2 outline-offset-2 outline-ring " : "") +
        (data.focus ? "ring-2 ring-ring/50 " : "") +
        (data.reading ? "is-reading " : "")
      }
      style={{ borderColor: data.reading ? "var(--amber)" : `color-mix(in srgb, ${color} 35%, var(--line))` }}
      dir="rtl"
      data-kind={data.kind}
      data-map={actions.mapView || undefined}
    >
      {actions.mapView && <MapFace data={data} />}
      <Handle type="target" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-card" style={{ background: color }} />
      <div className="flex items-center justify-between gap-3 px-3 pt-2.5">
        <span className="flex items-center gap-1.5" title={t(meta.hint)}>
          <span className="dot" style={{ background: color }} />
          <span className="text-[10.5px] font-medium tracking-wide" style={{ color }}>{t(headingKind ?? (data.phrase ? "kindPhrase" : data.entry ? "kindQuote" : meta.label))}</span>
        </span>
        <span className="flex items-center gap-1">
          {/* what is open in the comments on this card (EDT-194) */}
          <CommentMarker id={id} />
          {data.count != null && <span className="mono text-[11px] text-t3">{formatNumber(data.count, locale)}</span>}
          <button
            type="button"
            className="nodrag flex h-6 w-6 items-center justify-center rounded-md text-t3 hover:bg-card-2"
            aria-label={data.folded ? t("unfold") : t("fold")}
            aria-expanded={!data.folded}
            onClick={() => actions.toggleFold(id)}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className={data.folded ? "" : "rotate-180"}>
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      </div>

      <div className="px-3 pb-3">
        {data.kind === "note" && data.entry ? (
          <Quote entry={data.entry} folded={!!data.folded} />
        ) : heading ? (
          <div className="mt-1">
            <p className={heading === "entity" ? "ar-classical text-[22px] leading-[1.5] text-t1" : "text-[15px] font-semibold leading-snug text-t1"} lang="ar" dir="auto">{(data.text ?? "").split("\n")[0]}</p>
            {(data.text ?? "").split("\n")[1] && <p className="mt-0.5 text-[11px] text-t3" dir="auto">{(data.text ?? "").split("\n").slice(1).join(" ")}</p>}
          </div>
        ) : data.kind === "note" && data.phrase ? (
          // the reader's analysed phrase
          <p className="ar-classical mt-1 whitespace-pre-wrap text-[22px] leading-[1.7] text-t1" dir="auto">{data.text}</p>
        ) : data.kind === "note" ? (
          actions.editable ? (
            <textarea
              className="note-text nodrag mt-1 min-h-[64px] w-full resize-y rounded-lg border border-line bg-card-2 p-2 text-[14px] outline-none focus:border-ring"
              // as tall as its text, up to twelve lines (where field-sizing is not supported)
              rows={Math.min(12, Math.max(2, draft.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 36)), 0)))}
              value={draft}
              placeholder={t("noteHint")}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => draft !== (data.text ?? "") && actions.setText(id, draft)}
              onDoubleClick={(e) => e.stopPropagation()}
              aria-label={t("kindNote")}
            />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-[14px] text-t1">{data.text}</p>
          )
        ) : data.kind === "verse" && data.verse ? (
          <VerseLine verseKey={data.verse.key} places={data.places ?? []} folded={!!data.folded} />
        ) : (
          <p className={"ar-classical text-[28px] leading-[1.5] " + (data.kind === "root" ? "text-root" : data.kind === "pattern" ? "text-form" : "text-t1")} lang="ar">
            {data.ar}
          </p>
        )}

        {data.folded ? (
          // folded: one line, its summary (EDT-088)
          summary ? (
            <p className={"truncate text-[11.5px] text-t2 " + (data.kind === "lemma" ? "ar-classical text-[13px]" : "mono")} dir={data.kind === "lemma" ? "rtl" : "ltr"}>
              {summary}
            </p>
          ) : null
        ) : (
          <>
            {data.sub && data.kind !== "note" && translitLine && (
              <p className={"text-[12px] text-t3 " + (data.kind === "root" || data.kind === "pattern" ? "mono" : "ar-classical text-[14px]")} dir={data.kind === "root" || data.kind === "pattern" ? "ltr" : "rtl"}>
                {data.sub}
              </p>
            )}
            {data.kind === "lemma" && data.forms && data.forms.length > 0 && (
              <p className="mt-1 text-[12px] text-t3">
                <span className="sr-only">{t("formsLabel")}: </span>
                {data.forms.map((f, i) => (
                  <span key={f.form}>
                    {i > 0 && " · "}
                    <span className="ar-classical text-[14px] text-t2" lang="ar">{f.form}</span> <span className="mono text-[10.5px]">{formatNumber(f.count, locale)}</span>
                  </span>
                ))}
              </p>
            )}
            {data.kind === "lemma" && data.first && <FirstVerse place={data.first} />}
            {data.kind === "verse" && data.verse && <VerseCite verseKey={data.verse.key} />}
            {data.kind === "note" && !data.phrase && !data.entry && <p className="mt-1 text-[10.5px] text-t3">{t(headingFrom)}</p>}
            {data.reading && (
              <p className="reading-chip mt-1.5" title={t("readingHint")}>
                {t("readingChip", { conf: new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(data.reading.conf) })}
              </p>
            )}
            {data.kind === "root" && (data.usul === "several" || data.usul === "unrelated") && (
              <p className="usul-chip mt-1.5 rounded-md bg-card-2 px-2 py-1 text-[11.5px] leading-relaxed text-t2" data-usul={data.usul}>
                {t(data.usul === "unrelated" ? "usulUnrelatedCard" : "usulSeveralCard")}
              </p>
            )}
            <Stats id={id} data={data} />
            <Fields id={id} data={data} />
            <Extract id={id} data={data} />
            {data.kind === "root" && data.rootKey && actions.relations && actions.editable && (
              // a meaning map's roots: those the classical books relate to this one, reviewed by the board (P8.4)
              <div className="extract-row nodrag">
                <button type="button" className="extract-btn is-relate" disabled={!!actions.expanding} aria-busy={actions.expanding === id} title={t("relateHint")} onClick={() => actions.relate(id)}>
                  {actions.expanding === id ? t("extracting") : t("relate")}
                </button>
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.kind === "verse" && data.verse && <VersePlay verseKey={data.verse.key} />}
              {data.kind === "root" && data.rootKey && (
                <Link href={`/roots/${encodeURIComponent(data.rootKey)}`} className="nodrag btn min-h-[26px] px-2 text-[11.5px]">
                  {t("openRoot")}
                </Link>
              )}
              {data.kind === "lemma" && data.first && (
                <Link href={`/word/${data.first}`} className="nodrag btn min-h-[26px] px-2 text-[11.5px]">
                  {t("openReader")}
                </Link>
              )}
              {data.kind === "verse" && data.verse && (
                <Link href={data.places?.length === 1 ? `/word/${data.places[0]}` : `/quran/${data.verse.key.replace(":", "/")}`} className="nodrag btn min-h-[26px] px-2 text-[11.5px]">
                  {t("openReader")}
                </Link>
              )}
              {/* the card's actions (EDT-096): a note attached to it, and the card with its children selected */}
              {actions.editable && data.kind !== "note" && (
                <button type="button" className="nodrag btn min-h-[26px] px-2 text-[11.5px]" onClick={() => actions.attach(id)} title={t("attachHint")}>
                  {t("attachNote")}
                </button>
              )}
              {actions.editable && data.kind !== "note" && (
                <button type="button" className="nodrag btn min-h-[26px] px-2 text-[11.5px]" onClick={() => actions.focusCard(id)} title={t("focusHint")}>
                  {t("focusCard")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <Handle type="source" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-card" style={{ background: color }} />
    </div>
  );
}

/**
 * A dictionary's article quoted on a note (RDR-239): its opening words in «», cut at a word and marked «…», with the
 * work and its author and page — read from the dataset, as the reader shows it (D22, L2). The whole article is in
 * the details.
 */
function Quote({ entry, folded }: { entry: number; folded: boolean }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const e = useEntry(entry);
  if (e.isPending) return <span className="mt-1 block h-10 animate-pulse rounded bg-card-2" aria-hidden="true" />;
  if (!e.data) return <p className="mt-1 text-[12px] text-t3">{t("quoteUnavailable")}</p>;
  const { text, cut } = opening(e.data.body, folded ? 110 : 420);
  const ar = e.data.lang !== "en";
  return (
    <figure className="mt-1">
      <blockquote className={ar ? "ar-classical text-[15.5px] leading-[1.9] text-t1" : "text-[13px] leading-relaxed text-t1"} lang={ar ? "ar" : "en"} dir={ar ? "rtl" : "ltr"}>
        «{text}
        {cut && <span className="text-t3"> …</span>}»
      </blockquote>
      <figcaption className="mt-1 text-[11px] leading-relaxed text-t3">
        {locale === "ar" ? `${e.data.title_ar} — ${e.data.author_ar}` : `${e.data.title_en} — ${e.data.author_en}`}
        {e.data.page_ref && (
          <>
            {" · "}
            <bdi dir="ltr" className="whitespace-nowrap">{e.data.page_ref}</bdi>
          </>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * The stats strip (EDT-090, EDT-091): two or three numbers with their names — a root's patterns and words on the
 * map and what is left to extract; a pattern's words, their verses and what is left; a word's verses, its parents and
 * what is left; a verse's links, its words and what it has left to link; a note's links and fields.
 */
function Stats({ id, data }: { id: string; data: GraphNode["data"] }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const actions = useContext(GraphActionsContext);
  const s = actions.stats(id);
  const verse = useQuery({ queryKey: ["graph-verse", data.verse?.key], queryFn: () => getJSON<{ words: VerseWord[] }>(`/verses/${data.verse!.key}`), enabled: data.kind === "verse" && !!data.verse, staleTime: Infinity });
  const items: [number | null, string][] =
    data.kind === "root"
      ? [[s.a, "statForms"], [s.b, "statWordsShort"], [s.left, "statLeft"]]
      : data.kind === "pattern"
        ? [[s.a, "statWordsShort"], [s.b, "statVersesShort"], [s.left, "statLeft"]]
        : data.kind === "lemma"
          ? [[s.a, "statVersesShort"], [s.b, "statParents"], [s.left, "statLeft"]]
          : data.kind === "verse"
            ? [[s.a, "statLinked"], [verse.data?.words.length ?? null, "statVerseWords"], [verse.data ? actions.versePlan(id, verse.data.words, false).words.length : null, "statToLink"]]
            : [[s.a, "statAttached"], [s.b, "statFields"]];
  return (
    <dl className="card-stats">
      {items
        .filter(([v]) => v != null)
        .map(([v, k]) => (
          <div key={k}>
            <dd className="mono">{formatNumber(v!, locale)}</dd>
            <dt>{t(k)}</dt>
          </div>
        ))}
    </dl>
  );
}

/**
 * Extract (EDT-110…121): one button in the kind's colour — a root's patterns, a pattern's words, a word's next ten
 * verses («١٠ من ١٠٥»), with a sūra or a written form to choose from — dashed when there is nothing to draw from,
 * plain when all is on the map. A verse links its words, extracts their roots, or both, its particles only when
 * asked (QAN-08). A note has nothing to extract.
 */
function Extract({ id, data }: { id: string; data: GraphNode["data"] }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const actions = useContext(GraphActionsContext);
  const [open, setOpen] = useState(false);
  const color = KIND_COLOR[data.kind];
  if (data.kind === "frame") return null;
  if (data.kind === "note" && (id.startsWith("topic:") || id.startsWith("entity:"))) {
    // a topic's or a proper name's heading card gathers its verses, ten at a time (P8.3, P8.3b)
    const total = data.totals?.verses ?? 0;
    const taken = Number((data.cursor ?? "t:0").replace(/^t:/, "")) || 0;
    const left = Math.max(0, total - taken);
    const mine = actions.expanding === id;
    return (
      <div className="extract-row nodrag">
        <button
          type="button"
          className={"extract-btn" + (left ? "" : " is-done")}
          style={left ? { background: color, color: "var(--card)" } : undefined}
          disabled={!left || !actions.editable || !!actions.expanding}
          aria-busy={mine}
          onClick={() => actions.topicVerses(id)}
        >
          {mine ? t("extracting") : left ? t("topicVersesOf", { k: formatNumber(Math.min(10, left), locale), ...cnt(total, locale) }) : t("topicAllVerses")}
        </button>
      </div>
    );
  }
  if (data.kind === "note")
    return (
      <div className="extract-row">
        <button type="button" className="extract-btn is-none" disabled title={t("noteNoExtract")}>{t("noteAttached")}</button>
      </div>
    );
  if (data.kind === "verse") return <VerseExtract id={id} data={data} />;
  const s = actions.stats(id);
  const left = s.left;
  const mine = actions.expanding === id;
  const total = data.kind === "lemma" ? (data.totals?.verses ?? (left != null ? left + s.a : null)) : null;
  const label =
    data.kind === "root"
      ? left == null ? t("extractPatternsAny") : left > 0 ? t("extractPatterns", cnt(left, locale)) : t("allPatterns")
      : data.kind === "pattern"
        ? left == null ? t("extractWordsAny") : left > 0 ? t("extractWords", cnt(left, locale)) : t("allWords")
        : left == null ? t("extractVersesAny") : left > 0 ? t("extractVersesOf", { k: formatNumber(Math.min(10, left), locale), ...cnt(total ?? left, locale) }) : t("allVerses");
  const done = left === 0;
  const none = data.kind === "lemma" ? !data.slug : data.kind === "pattern" ? !data.slug : !data.rootKey;
  return (
    <div className="extract-row nodrag">
      <button
        type="button"
        className={"extract-btn" + (done ? " is-done" : none ? " is-none" : "")}
        style={done || none ? undefined : { background: color, color: "var(--card)" }}
        disabled={done || none || !!actions.expanding}
        aria-busy={mine}
        title={done ? t("extractDone") : t("extractHint", { label })}
        onClick={() => actions.expand(id)}
      >
        {mine ? t("extracting") : label}
      </button>
      {data.kind === "lemma" && data.slug && !done && (
        <button type="button" className="extract-caret" style={{ borderColor: color, color }} onClick={() => setOpen(!open)} aria-expanded={open} title={t("extractFilterHint")} aria-label={t("extractFilterHint")}>
          ▾
        </button>
      )}
      {open && data.kind === "lemma" && data.slug && (
        <VerseFilter
          slug={data.slug}
          onPick={(opts) => {
            setOpen(false);
            actions.expand(id, opts);
          }}
        />
      )}
    </div>
  );
}

/** A word's verses narrowed to a sūra or a written form (QAN-06), the choices counted. */
function VerseFilter({ slug, onPick }: { slug: string; onPick: (o: ExtractOptions) => void }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const [surah, setSurah] = useState("");
  const [form, setForm] = useState("");
  const q = useQuery({
    queryKey: ["graph-word-verses-facets", slug],
    queryFn: () => getJSON<{ surahs: { surah: number; name_ar: string; name_translit: string; verses: number }[]; forms: { form: string; verses: number }[] }>(`/words/${encodeURIComponent(slug)}/verses?limit=1`),
    staleTime: Infinity,
  });
  return (
    <div className="extract-menu" role="group" aria-label={t("extractFilterHint")}>
      {q.isPending ? (
        <span className="block h-10 animate-pulse rounded bg-card-2" aria-hidden="true" />
      ) : (
        <>
          <label className="flex flex-col gap-0.5 text-[11.5px] text-t3">
            {t("filterSurah")}
            <select className="field-input" value={surah} onChange={(e) => setSurah(e.target.value)}>
              <option value="">{t("filterAll")}</option>
              {q.data?.surahs.map((s) => (
                <option key={s.surah} value={s.surah}>{`${locale === "ar" ? s.name_ar : s.name_translit} (${formatNumber(s.verses, locale)})`}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11.5px] text-t3">
            {t("filterForm")}
            <select className="field-input quran" lang="ar" value={form} onChange={(e) => setForm(e.target.value)}>
              <option value="">{t("filterAll")}</option>
              {q.data?.forms.map((f) => (
                <option key={f.form} value={f.form}>{`${f.form} (${formatNumber(f.verses, locale)})`}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn text-[12px]" onClick={() => onPick({ ...(surah ? { surah: Number(surah) } : {}), ...(form ? { form } : {}) })}>
            {t("filterExtract")}
          </button>
        </>
      )}
    </div>
  );
}

/** A verse's words and roots (EDT-115…118): the first thing left as its button; the three choices under its caret,
 * each with what it brings; particles left out unless the reader asks for them (QAN-08). */
function VerseExtract({ id, data }: { id: string; data: GraphNode["data"] }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const actions = useContext(GraphActionsContext);
  const [open, setOpen] = useState(false);
  const [particles, setParticles] = useState(false);
  const q = useQuery({ queryKey: ["graph-verse", data.verse!.key], queryFn: () => getJSON<{ words: VerseWord[] }>(`/verses/${data.verse!.key}`), staleTime: Infinity });
  const color = KIND_COLOR.verse;
  const plan = q.data ? actions.versePlan(id, q.data.words, particles) : { words: [], roots: [] };
  const mine = actions.expanding === id;
  const words = plan.words.length;
  const roots = plan.roots.length;
  const first = words ? t("linkWords", cnt(words, locale)) : roots ? t("extractRoots", cnt(roots, locale)) : t("allLinked");
  const done = !!q.data && !words && !roots;
  const run = (mode: "words" | "roots" | "both") => {
    setOpen(false);
    actions.expand(id, { mode, particles });
  };
  const spacedRoot = (k: string) => k.split("").join(" ");
  return (
    <div className="extract-row nodrag">
      <button
        type="button"
        className={"extract-btn" + (done ? " is-done" : "")}
        style={done ? undefined : { background: color, color: "var(--card)" }}
        disabled={done || !q.data || !!actions.expanding}
        aria-busy={mine}
        title={done ? t("linkDone") : t("extractHint", { label: first })}
        onClick={() => run(words ? "words" : "roots")}
      >
        {mine ? t("extracting") : first}
      </button>
      {!done && (
        <button type="button" className="extract-caret" style={{ borderColor: color, color }} onClick={() => setOpen(!open)} aria-expanded={open} title={t("linkChoose")} aria-label={t("linkChoose")}>
          ▾
        </button>
      )}
      {open && (
        <div className="extract-menu" role="group" aria-label={t("linkChoose")}>
          {words > 0 && (
            <button type="button" className="extract-option" onClick={() => run("words")}>
              <span>{t("linkWords", cnt(words, locale))}</span>
              <span className="ar-classical text-[14px] text-t2" lang="ar">{plan.words.map((w) => w.lemma).join("  ·  ")}</span>
            </button>
          )}
          {roots > 0 && (
            <button type="button" className="extract-option" onClick={() => run("roots")}>
              <span>{t("extractRoots", cnt(roots, locale))}</span>
              <span className="ar-classical text-[14px] text-root" lang="ar">{plan.roots.map(spacedRoot).join("  ·  ")}</span>
            </button>
          )}
          {words > 0 && roots > 0 && (
            <button type="button" className="extract-option" onClick={() => run("both")}>
              <span>{t("linkBoth")}</span>
              <span className="ar-classical text-[14px] text-t2" lang="ar">{[...plan.words.map((w) => w.lemma), ...plan.roots.map(spacedRoot)].join("  ·  ")}</span>
            </button>
          )}
          <label className="flex items-center gap-2 text-[12px] text-t2">
            <input type="checkbox" checked={particles} onChange={(e) => setParticles(e.target.checked)} />
            {t("withParticles")}
          </label>
        </div>
      )}
    </div>
  );
}

/** A verse recited (QAN-02): the reader's reciter, played here; credited in the details. */
function VersePlay({ verseKey }: { verseKey: string }) {
  const t = useTranslations("graph");
  const reciter = useAudio((s) => s.reciter);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  async function toggle() {
    if (playing && audio.current) {
      audio.current.pause();
      return;
    }
    try {
      const r = await getJSON<{ url: string }>(`/recitations/${reciter}/verses/${verseKey}`);
      audio.current?.pause();
      const a = new Audio(r.url);
      audio.current = a;
      a.onplay = () => setPlaying(true);
      a.onpause = a.onended = () => setPlaying(false);
      await a.play();
    } catch {
      setPlaying(false);
    }
  }
  return (
    <button type="button" className="nodrag btn min-h-[26px] px-2 text-[11.5px]" onClick={() => void toggle()} aria-pressed={playing} title={t("playVerseHint")}>
      {playing ? t("stopVerse") : t("playVerse")}
    </button>
  );
}

/** The reader's fields on the card (EDT-092…094, EDT-102…109): added from a menu of the ten kinds, edited in place,
 * removed with ×; their labels renamed in the details. */
function Fields({ id, data }: { id: string; data: GraphNode["data"] }) {
  const t = useTranslations("graph");
  const actions = useContext(GraphActionsContext);
  const [menu, setMenu] = useState(false);
  const fields = data.fields ?? [];
  if (!actions.editable && !fields.length) return null;
  return (
    <section className="card-fields nodrag" onDoubleClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <span className="label-caps">{t("fieldsTitle")}</span>
        <span className="h-px flex-1 bg-line" />
        {actions.editable && (
          <button type="button" className="text-[11.5px] text-word" onClick={() => setMenu(!menu)} aria-expanded={menu} title={t("fieldAddHint")}>
            {t("fieldAdd")}
          </button>
        )}
      </div>
      {menu && (
        <div className="field-menu" role="menu" aria-label={t("fieldAddHint")}>
          {FIELD_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                actions.addField(id, k);
              }}
            >
              {t(`field_${k}`)}
            </button>
          ))}
        </div>
      )}
      {fields.length === 0 ? (
        <p className="text-[11.5px] leading-relaxed text-t3">{t("fieldsEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {fields.map((f) => (
            <FieldEditor
              key={f.id}
              field={f}
              density="card"
              editable={actions.editable}
              onValue={(v, name) => actions.editField(id, f.id, v, name)}
              onRemove={() => actions.removeField(id, f.id)}
              onError={actions.toast}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export const CardNode = memo(CardNodeImpl);

/**
 * A card in the map view (EDT-058, QAN-20): its headline in large Arabic over the card, which keeps its size
 * underneath (hidden, not removed, so its measure does not change, HWF-02, HWF-03) — a root's letters, a pattern,
 * a word, a verse's reference (its words are too long to read from afar), a note's first line — and, with
 * transliteration on, its Latin line; in the Arabic interface, Arabic only.
 */
function MapFace({ data }: { data: GraphNode["data"] }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const actions = useContext(GraphActionsContext);
  const v = useVerseText(data.kind === "verse" ? data.verse?.key : undefined);
  const quote = useEntry(data.kind === "note" ? data.entry : undefined);
  const head =
    data.kind === "verse"
      ? v.data
        ? citeVerse(v.data.surah_name_ar, v.data.surah, v.data.ayah, "ar")
        : (data.verse?.key ?? "")
      : data.kind === "note" && data.entry
        ? (quote.data?.title_ar ?? t("kindQuote"))
        : data.kind === "note"
        ? (data.text ?? "").split("\n")[0] || t(data.phrase ? "kindPhrase" : "kindNote")
        : data.kind === "frame"
          ? data.title || t("kindFrame")
          : (data.ar ?? "");
  const latin = actions.translit && (data.kind === "root" || data.kind === "pattern") ? data.sub : undefined;
  return (
    <div className="map-face" aria-hidden="true">
      <span className={"map-face-head" + (data.kind === "root" ? " is-root" : data.kind === "verse" ? " is-verse" : "")} lang="ar">{head}</span>
      {latin && locale !== "ar" && (
        <span className="map-face-latin">
          <span className="dot" style={{ background: KIND_COLOR[data.kind] }} />
          <span className="mono" dir="ltr">{latin.slice(0, 26)}</span>
        </span>
      )}
    </div>
  );
}

/** A frame's acts, beside the cards' (EDT-140…149): its members, counted live by where they lie. */
export type FrameActions = { members: (id: string) => string[]; resize: (id: string, box: { x: number; y: number; w: number; h: number }) => void; selectInside: (id: string) => void };
export const FrameActionsContext = createContext<FrameActions>({ members: () => [], resize: () => {}, selectInside: () => {} });

/**
 * A frame (QAN-01 «مجموعة»; EDT-143…146, HWF-29): a dashed box behind the cards with a bar that names it and counts
 * the cards fully inside it; the bar moves it and them, a double-click on the bar selects them, and its handles
 * resize it on the 8 px grid. It has no meaning of its own and no links.
 */
function FrameNodeImpl({ id, data, selected }: NodeProps<GraphNode>) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const actions = useContext(GraphActionsContext);
  const frames = useContext(FrameActionsContext);
  const n = frames.members(id).length;
  const label = data.title || t("groupUntitled");
  return (
    <div className={"graph-frame" + (selected ? " is-selected" : "")} dir="rtl">
      <NodeResizer
        isVisible={selected && actions.editable}
        minWidth={64}
        minHeight={64}
        lineClassName="frame-resize-line"
        handleClassName="frame-resize-handle"
        onResizeEnd={(_, p) => frames.resize(id, { x: p.x, y: p.y, w: p.width, h: p.height })}
      />
      <div
        className="frame-bar"
        title={t("groupBarHint", { label, ...cnt(n, locale) })}
        onDoubleClick={(e) => {
          e.stopPropagation();
          frames.selectInside(id);
        }}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <span className="text-t3">{t("cards", cnt(n, locale))}</span>
      </div>
    </div>
  );
}

export const FrameNode = memo(FrameNodeImpl);

/** The verse's words, drawn from the dataset: around its one marked place, every cut marked «…», or whole with
 * every place marked (law L1; P8.0 F3). */
function Excerpted({ verseKey, places, className, wordClass, around = 5 }: { verseKey: string; places: string[]; className: string; wordClass: string; around?: number }) {
  const t = useTranslations("graph");
  const v = useVerseText(verseKey);
  if (v.isPending) return <span className="mt-1 block h-6 animate-pulse rounded bg-card-2" aria-hidden="true" />;
  if (!v.data) return <p className="mt-1 text-[12px] text-t3">{t("verseUnavailable")}</p>;
  if (places.length > 1)
    return (
      <p className={className} lang="ar">
        {markedVerse(v.data, places).map((s, i) => (
          <span key={i}>
            {i > 0 && " "}
            {s.marked ? <mark className={wordClass}>{s.text}</mark> : <span className="text-t2">{s.text}</span>}
          </span>
        ))}
      </p>
    );
  const x = excerptOf(v.data, places[0], around);
  return (
    <p className={className} lang="ar">
      {x.cutLeft && <span className="text-t3">… </span>}
      <span className="text-t2">{x.left}</span>
      {x.word && (
        <>
          {" "}
          <mark className={wordClass}>{x.word}</mark>{" "}
        </>
      )}
      <span className="text-t2">{x.right}</span>
      {x.cutRight && <span className="text-t3"> …</span>}
    </p>
  );
}

/** A verse on its card: open, around its marked word; folded, one line — the word with a word either side (QAN-03). */
function VerseLine({ verseKey, places, folded }: { verseKey: string; places: string[]; folded?: boolean }) {
  return (
    <Excerpted
      verseKey={verseKey}
      places={folded ? places.slice(0, 1) : places}
      around={folded ? 1 : 5}
      className={"quran mt-1 leading-[2.1] text-t1 " + (folded ? "text-[17px]" : "text-[19px]")}
      wordClass="rounded bg-sentence-wash px-0.5 text-t1"
    />
  );
}

function VerseCite({ verseKey }: { verseKey: string }) {
  const locale = useLocale();
  const v = useVerseText(verseKey);
  if (!v.data) return null;
  return <p className="mt-1 text-[11.5px] text-t3">{citeVerse(v.data.surah_name_ar, v.data.surah, v.data.ayah, locale, v.data.surah_name_translit)}</p>;
}

/** A word's first occurrence, the word marked in its verse. */
function FirstVerse({ place }: { place: string }) {
  const t = useTranslations("graph");
  return (
    <div className="mt-2 rounded-lg bg-card-2 px-2 py-1.5">
      <p className="text-[10.5px] text-t3">{t("firstVerse")}</p>
      <Excerpted verseKey={keyOf(place)} places={[place]} around={3} className="quran text-[16px] leading-[2]" wordClass="bg-transparent text-word" />
      <VerseCite verseKey={keyOf(place)} />
    </div>
  );
}

