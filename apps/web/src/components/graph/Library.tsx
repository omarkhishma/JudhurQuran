"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Switch } from "@/components/ui/Switch";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { lemmaId, patternId, rootId, verseId } from "@/lib/graph/build";
import { findCards } from "@/lib/graph/find";
import { newId } from "@/lib/graph/persist";
import { META } from "@/lib/graph/relations";
import { translitOn, useGraphUi } from "@/lib/graph/uiPrefs";
import { KIND_COLOR, type GraphKind, type GraphNode, type NodeKind } from "@/lib/graph/types";
import type { VerseText } from "@/lib/graph/verseText";
import type { SearchResult } from "@/lib/types";
import { useDebounced } from "@/lib/useDebounced";
import { DRAG_TYPE, useCanvasTools, type CanvasTools } from "./GraphCanvas";

/** The kinds a reader can begin a card from (frames come with P8.1-C). */
const TILE_KINDS: NodeKind[] = ["root", "pattern", "lemma", "verse", "note"];
/** The design's Arabic names, shown beside the English labels in the English interface (EDT-041). */
const AR_NAME: Partial<Record<NodeKind, string>> = { root: "جَذْر", pattern: "وَزْن", lemma: "كَلِمَة", verse: "آيَة", note: "مُلَاحَظَة" };

type RootRow = { key: string; spaced: string; translit: string; occurrences: number; lemma_count: number; pattern_count?: number };

/** What a drag from the library carries: the cards to add, or a kind to choose a card of. */
export type LibraryPayload = { cards: GraphNode[]; label: string } | { pick: NodeKind };

const rootCard = (r: RootRow): GraphNode => ({ id: rootId(r.key), type: "card", position: { x: 0, y: 0 }, data: { kind: "root", ar: r.spaced, sub: r.translit, count: r.occurrences, rootKey: r.key } });
const noteCard = (): GraphNode => ({ id: `note:${newId()}`, type: "card", position: { x: 0, y: 0 }, data: { kind: "note", text: "" } });

/**
 * The library (EDT-032…047, P8.1-A): find a card on the map; the kinds of card, with what each is; the dataset to
 * add from — roots, words, patterns and verses, never invented ones (L1, L2); the roots the map already touches;
 * and the keys. It folds to a rail, and remembers that on this device.
 */
export function Library({ kind, onPick, pendingDrop, setPendingDrop, onHelp }: {
  kind: GraphKind;
  onPick: (kind: NodeKind | null) => void;
  pendingDrop: { x: number; y: number } | null;
  setPendingDrop: (at: { x: number; y: number } | null) => void;
  onHelp: () => void;
}) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const tools = useCanvasTools();
  const open = useGraphUi((s) => s.libraryOpen);
  const typesHidden = useGraphUi((s) => s.typesHidden);
  const translitPref = useGraphUi((s) => s.translit);
  const setUi = useGraphUi((s) => s.set);
  const translit = translitOn(translitPref, locale);
  const addInput = useRef<HTMLInputElement>(null);
  const [pick, setPick] = useState<NodeKind | null>(null);

  // a tile asks which card of its kind: the search below, narrowed to that kind (a card is always a real object)
  const choose = (k: NodeKind, at?: { x: number; y: number }) => {
    if (k === "note") return tools.addCards([noteCard()], [], t("doAddNote"), at);
    setPick(k);
    onPick(k);
    setPendingDrop(at ?? null);
    requestAnimationFrame(() => addInput.current?.focus());
  };
  // the canvas hands a drop back to the library, which knows what was dragged
  useEffect(() => {
    const onDrop = (e: Event) => {
      const { payload, at } = (e as CustomEvent<{ payload: LibraryPayload; at: { x: number; y: number } }>).detail;
      if ("pick" in payload) choose(payload.pick, at);
      else tools.addCards(payload.cards, [], payload.label, at);
    };
    window.addEventListener("jadhr:library-drop", onDrop);
    return () => window.removeEventListener("jadhr:library-drop", onDrop);
  });

  if (!open)
    return (
      <aside className="library-rail" aria-label={t("library")}>
        <button type="button" className="btn icon-btn" onClick={() => setUi({ libraryOpen: true })} title={t("libraryShow")} aria-label={t("libraryShow")} aria-expanded={false}>
          <Icon name="chevronEnd" />
        </button>
        <span className="library-rail-label">{t("library")}</span>
      </aside>
    );

  return (
    <aside className="library" aria-label={t("library")}>
      <FindCard tools={tools} onHide={() => setUi({ libraryOpen: false })} />
      <section className="library-section">
        <button type="button" className="library-head" aria-expanded={!typesHidden} onClick={() => setUi({ typesHidden: !typesHidden })} title={t("typesToggle")}>
          <span className="label-caps">{t("cardTypes")}</span>
          <span className="text-[11.5px] text-t3">{typesHidden ? t("show") : t("hide")}</span>
        </button>
        {!typesHidden && (
          <ul className="flex flex-col gap-1.5">
            {TILE_KINDS.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  className="type-tile"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ pick: k } satisfies LibraryPayload));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => choose(k)}
                  title={t(META[k].hint)}
                >
                  <span className="flex items-center gap-2">
                    <span className="dot" style={{ background: KIND_COLOR[k] }} />
                    <span className="text-[12.5px] font-medium text-t1">{t(META[k].label)}</span>
                    {locale !== "ar" && <span className="ms-auto text-[12.5px] text-t2" lang="ar" dir="rtl">{AR_NAME[k]}</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-t3">{t(META[k].hint)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <AddFromData
        tools={tools}
        kind={kind}
        pick={pick}
        clearPick={() => {
          setPick(null);
          onPick(null);
          setPendingDrop(null);
        }}
        inputRef={addInput}
        at={pendingDrop}
        translit={translit}
      />
      <MapRoots tools={tools} translit={translit} />
      <footer className="library-foot">
        <Switch checked={translit} onChange={(v) => setUi({ translit: v })} label={t("translitPref")} hint={t("translitHint")} />
        <button type="button" className="btn w-full justify-between" onClick={onHelp}>
          {t("shortcuts")}
          <kbd className="kbd">?</kbd>
        </button>
      </footer>
    </aside>
  );
}

/** Find a card on the map (EDT-034…039, EDT-247): matches counted, stepped through with Enter and ⇧Enter, the
 * rest dimmed; Escape clears. */
function FindCard({ tools, onHide }: { tools: CanvasTools; onHide: () => void }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [at, setAt] = useState(-1);
  const matches = useMemo(
    () => findCards(tools.nodes, q, (key) => qc.getQueryData<VerseText | null>(["verse-text", key]) ?? undefined),
    [tools.nodes, q, qc],
  );
  const { setMatches } = tools;
  useEffect(() => {
    setMatches(q.trim() ? matches : null);
  }, [q, matches, setMatches]);
  useEffect(() => () => setMatches(null), [setMatches]);

  const step = (dir: 1 | -1) => {
    if (!matches.length) return tools.toast(t("findNone"));
    const sel = tools.selected.length === 1 ? matches.indexOf(tools.selected[0].id) : at;
    const next = sel < 0 ? (dir === 1 ? 0 : matches.length - 1) : (sel + dir + matches.length) % matches.length;
    setAt(next);
    // a match is shown with its details (EDT-038)
    useGraphUi.getState().set({ detailsOpen: true });
    tools.select(matches[next]);
    tools.center(matches[next]);
    tools.toast(t("findMatch", { i: formatNumber(next + 1, locale), n: formatNumber(matches.length, locale) }));
  };

  return (
    <div className="library-find">
      <div className="flex items-center gap-1.5">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAt(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              step(e.shiftKey ? -1 : 1);
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setQ("");
            }
          }}
          placeholder={t("findPlaceholder")}
          aria-label={t("findLabel")}
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-[13.5px] outline-none focus:border-ring"
        />
        <button type="button" className="btn icon-btn" onClick={onHide} title={t("libraryHide")} aria-label={t("libraryHide")} aria-expanded>
          <Icon name="chevronStart" />
        </button>
      </div>
      {q.trim() && (
        <div className="mt-1.5 flex items-center gap-1 text-[12px] text-t2" role="status" aria-live="polite">
          <span className="flex-1">{t("findCount", { ...cnt(tools.nodes.length, locale), m: formatNumber(matches.length, locale) })}</span>
          <button type="button" className="btn icon-btn" onClick={() => step(-1)} title={t("findPrevTitle")} aria-label={t("findPrev")}>
            <Icon name="arrowUp" />
          </button>
          <button type="button" className="btn icon-btn" onClick={() => step(1)} title={t("findNextTitle")} aria-label={t("findNext")}>
            <Icon name="arrowUp" className="rotate-180" />
          </button>
          <button type="button" className="btn icon-btn hover:text-bad" onClick={() => setQ("")} title={t("findClear")} aria-label={t("findClear")}>
            <Icon name="close" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The dataset, to add from (the palette that was): roots, words, written forms, patterns and verses found by the
 * search the reader uses everywhere (folded, references in either digits). A tile's kind narrows it; a row added
 * after a drop lands where it was dropped; a row can itself be dragged onto the canvas.
 */
function AddFromData({ tools, kind, pick, clearPick, inputRef, at, translit }: {
  tools: CanvasTools;
  kind: GraphKind;
  pick: NodeKind | null;
  clearPick: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  at: { x: number; y: number } | null;
  translit: boolean;
}) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 200);
  const { data } = useQuery({
    queryKey: ["palette-search", dq],
    enabled: dq.length > 0,
    queryFn: async () => (await (await fetch(`/api/v1/search?q=${encodeURIComponent(dq)}&limit=6`)).json()) as SearchResult,
  });
  const show = (k: NodeKind) => !pick || pick === k;
  const add = (cards: GraphNode[], label: string) => {
    tools.addCards(cards, [], label, at ?? undefined);
    if (pick) clearPick();
  };
  const drag = (cards: GraphNode[], label: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ cards, label } satisfies LibraryPayload));
    e.dataTransfer.effectAllowed = "copy";
  };

  type LemmaRow = { slug: string; ar: string; pos: string; pos_label?: { ar: string; en: string }; occurrences: number; root: string | null };
  const lemmaCard = (l: LemmaRow, first?: string): GraphNode => ({
    id: lemmaId(l.slug),
    type: "card",
    position: { x: 0, y: 0 },
    data: { kind: "lemma", slug: l.slug, ar: l.ar, sub: l.pos_label?.[locale === "ar" ? "ar" : "en"] ?? l.pos, count: l.occurrences, ...(l.root ? { rootKey: l.root } : {}), ...(first ? { first } : {}) },
  });
  /** A written form found by search adds its word (the lemma), first met where the search found it. */
  async function addForm(lemma: number, sample: string) {
    const d = (await (await fetch(`/api/v1/lemmas?ids=${lemma}`)).json()) as { data: LemmaRow[] };
    if (d.data[0]) add([lemmaCard(d.data[0], sample)], t("doAddWord", { word: d.data[0].ar }));
  }
  const lemmaIds = new Set(data?.results.lemmas.map((l) => l.id));
  const row = "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-start hover:bg-card";

  return (
    <section className="library-section">
      <p className="label-caps mb-1.5">{t("addTitle")}</p>
      {pick && (
        <p className="mb-1.5 flex items-center gap-1.5 text-[12px] text-t2">
          <span className="dot" style={{ background: KIND_COLOR[pick] }} />
          {t("pickKind", { kind: t(META[pick].label) })}
          {at && <span className="text-t3">· {t("pickAtDrop")}</span>}
          <button type="button" className="btn icon-btn ms-auto" onClick={clearPick} aria-label={t("pickClear")} title={t("pickClear")}>
            <Icon name="close" size={12} />
          </button>
        </p>
      )}
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("addSearch")}
        aria-label={t("addSearch")}
        className="h-9 w-full rounded-lg border border-line bg-card px-3 text-[13.5px] outline-none focus:border-ring"
      />
      {kind === "meaning" && <p className="mt-1.5 text-[11.5px] leading-snug text-t3">{t("meaningHint")}</p>}
      <p className="mt-1.5 text-[11.5px] leading-snug text-t3">{t("connectHint")}</p>
      <ul className="mt-1 space-y-0.5">
        {show("root") &&
          data?.results.roots.map((r) => {
            const card = rootCard(r);
            const label = t("doAddRoot", { root: locale === "ar" ? r.spaced : r.translit });
            return (
              <li key={`r${r.key}`}>
                <button type="button" className={row} draggable onDragStart={drag([card], label)} onClick={() => add([card], label)}>
                  <span className="flex items-center gap-2">
                    <span className="dot" style={{ background: KIND_COLOR.root }} />
                    <span className="ar-classical text-[18px] text-root" lang="ar">{r.spaced}</span>
                    {translit && <span className="mono text-[11px] text-t3" dir="ltr">{r.translit}</span>}
                  </span>
                  <span className="mono text-[11px] text-t3">{formatNumber(r.occurrences, locale)}</span>
                </button>
              </li>
            );
          })}
        {show("lemma") &&
          data?.results.lemmas.slice(0, 6).map((l) => {
            const card = lemmaCard(l);
            const label = t("doAddWord", { word: l.ar });
            return (
              <li key={`l${l.id}`}>
                <button type="button" className={row} draggable onDragStart={drag([card], label)} onClick={() => add([card], label)}>
                  <span className="flex items-center gap-2">
                    <span className="dot" style={{ background: KIND_COLOR.lemma }} />
                    <span className="ar-classical text-[18px]" lang="ar">{l.ar}</span>
                    {l.root_spaced && <span className="ar-classical text-[13px] text-root" lang="ar">{l.root_spaced}</span>}
                  </span>
                  <span className="mono text-[11px] text-t3">{formatNumber(l.occurrences, locale)}</span>
                </button>
              </li>
            );
          })}
        {show("lemma") &&
          data?.results.words
            .filter((w) => w.lemma_id != null && !lemmaIds.has(w.lemma_id))
            .map((w) => (
              <li key={`w${w.form}-${w.lemma_id}`}>
                <button type="button" className={row} onClick={() => void addForm(w.lemma_id!, w.sample)}>
                  <span className="flex items-center gap-2"><span className="dot" style={{ background: KIND_COLOR.lemma }} /><span className="ar-classical text-[18px]" lang="ar">{w.display}</span></span>
                  <span className="mono text-[11px] text-t3">{formatNumber(w.occurrences, locale)}</span>
                </button>
              </li>
            ))}
        {show("pattern") &&
          data?.results.patterns?.slice(0, 3).map((p) => {
            const card: GraphNode = { id: patternId(p.slug), type: "card", position: { x: 0, y: 0 }, data: { kind: "pattern", slug: p.slug, ar: p.ar.full, sub: p.ar.translit, count: p.lemma_count } };
            const label = t("doAddPattern", { pattern: p.ar.full });
            return (
              <li key={`p${p.slug}`}>
                <button type="button" className={row} draggable onDragStart={drag([card], label)} onClick={() => add([card], label)}>
                  <span className="flex items-center gap-2">
                    <span className="dot" style={{ background: KIND_COLOR.pattern }} />
                    <span className="ar-classical text-[18px] text-form" lang="ar">{p.ar.full}</span>
                    <span className="text-[11px] text-t3">{t("kindPattern")}</span>
                  </span>
                  <span className="mono text-[11px] text-t3">{formatNumber(p.lemma_count, locale)}</span>
                </button>
              </li>
            );
          })}
        {show("verse") &&
          data?.results.verses.slice(0, 4).map((v) => {
            const card: GraphNode = { id: verseId(v.key), type: "card", position: { x: 0, y: 0 }, data: { kind: "verse", verse: { key: v.key } } };
            const label = t("doAddVerse", { ref: verseRef(v.key, locale) });
            return (
              <li key={`v${v.key}`}>
                <button type="button" className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start hover:bg-card" draggable onDragStart={drag([card], label)} onClick={() => add([card], label)}>
                  <span className="dot mt-3" style={{ background: KIND_COLOR.verse }} />
                  <span className="min-w-0">
                    <span className="quran line-clamp-2 text-[16px] leading-[2]" lang="ar">{v.text_qpc}</span>
                    <span className="text-[11px] text-t3">{v.name_ar}: {formatNumber(v.ayah, locale)}</span>
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}

/** The roots this map touches (EDT-044, EDT-045, EDT-242): each with its patterns and words, dimmed when already
 * on the map — where it is selected and shown — and added, or dragged in, when not. */
function MapRoots({ tools, translit }: { tools: CanvasTools; translit: boolean }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const keys = useMemo(() => [...new Set(tools.nodes.flatMap((n) => (n.data.rootKey ? [n.data.rootKey] : [])))].sort(), [tools.nodes]);
  const { data } = useQuery({
    queryKey: ["roots-by-key", keys.join(",")],
    enabled: keys.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => ((await (await fetch(`/api/v1/roots?keys=${encodeURIComponent(keys.join(","))}&limit=${keys.length}`)).json()) as { data: RootRow[] }).data,
  });
  if (!keys.length) return null;
  const on = new Set(tools.nodes.filter((n) => n.data.kind === "root").map((n) => n.id));
  return (
    <section className="library-section">
      <p className="label-caps mb-1.5">{t("mapRoots")}</p>
      <ul className="flex flex-col gap-1.5">
        {(data ?? []).map((r) => {
          const id = rootId(r.key);
          const present = on.has(id);
          const label = t("doAddRoot", { root: locale === "ar" ? r.spaced : r.translit });
          return (
            <li key={r.key}>
              <button
                type="button"
                className={"root-tile" + (present ? " is-present" : "")}
                draggable={!present}
                onDragStart={drag(r, label)}
                title={present ? t("rootOnCanvas") : t("rootDragHint")}
                onClick={() => {
                  if (!present) return tools.addCards([rootCard(r)], [], label);
                  tools.select(id);
                  tools.center(id);
                  tools.toast(t("rootAlready"));
                }}
              >
                <span className="flex items-baseline gap-2">
                  <span className="ar-classical text-[19px] tracking-[.06em] text-root" lang="ar" dir="rtl">{r.spaced}</span>
                  {translit && <span className="mono ms-auto text-[11px] text-t3" dir="ltr">{r.translit}</span>}
                </span>
                <span className="block text-[11.5px] text-t3">
                  {t("rootCounts", { patterns: t("patternsCount", cnt(r.pattern_count ?? 0, locale)), words: t("wordsCount", cnt(r.lemma_count, locale)) })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );

  function drag(r: RootRow, label: string) {
    return (e: React.DragEvent) => {
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ cards: [rootCard(r)], label } satisfies LibraryPayload));
      e.dataTransfer.effectAllowed = "copy";
    };
  }
}
