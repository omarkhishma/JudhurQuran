"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Link } from "@/i18n/navigation";
import { verseRef } from "@/lib/format";
import { createGraph, loadGraph } from "@/lib/graph/persist";
import { surahNames } from "@/lib/graph/seed";
import type { ReadingContext } from "@/lib/reader/store";
import type { SplitMessage } from "@/components/graph/SplitReceiver";

const MAP_KEY = "jadhr-split-map";
const PERSONAL_KEY = "jadhr-personal";
type Panes = { reader: boolean; graph: boolean };

function subscribeNarrow(cb: () => void) {
  const m = window.matchMedia("(max-width: 767px)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia("(max-width: 767px)").matches, () => false);

function readContext(): ReadingContext | null {
  try {
    return (JSON.parse(localStorage.getItem(PERSONAL_KEY) ?? "null")?.state?.context as ReadingContext | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * The split view (P8.6; EDT-313…323, HWF-41): the reader and a map side by side. The panes are the reader and the
 * editor themselves, each in a frame of this site, so each lays out as it does alone; they share state by events,
 * never by polling — the reader's reading context through the browser's storage events, compared before it is
 * drawn again; «أرسل الكلمة إلى الخريطة» hands the open editor the word, which it adds with its pattern, part of
 * speech, root and place as one undoable step, without a reload. Two toggles show either pane or both, never none;
 * on a phone one pane at a time. The graph pane keeps the map it last showed.
 */
export function SplitView({ surah, map }: { surah: number; map: string | null }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const narrow = useNarrow();
  const [panes, setPanes] = useState<Panes>({ reader: true, graph: true });
  const [mapId, setMapId] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ReadingContext | null>(null);
  const [names, setNames] = useState<Map<number, string> | null>(null);
  const [said, setSaid] = useState("");
  const graph = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const pending = useRef<SplitMessage | null>(null);

  // the reading context: read now, and again each time the reader writes it — only drawn when it changed (HWF-41)
  useEffect(() => {
    const read = () => setCtx((old) => {
      const c = readContext();
      return JSON.stringify(old) === JSON.stringify(c) ? old : c;
    });
    read();
    const on = (e: StorageEvent) => {
      if (e.key === PERSONAL_KEY || e.key === null) read();
    };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);
  useEffect(() => {
    void surahNames().then(setNames).catch(() => {});
  }, []);

  // the map: the one asked for, or the one this view showed last, or a new one made once
  useEffect(() => {
    let live = true;
    void (async () => {
      let kept: string | null = map;
      try {
        kept ??= localStorage.getItem(MAP_KEY);
      } catch {}
      if (kept && (await loadGraph(kept))) {
        if (live) setMapId(kept);
        return;
      }
      const id = await createGraph({ title: t("splitMapTitle"), kind: "free", nodes: [], edges: [] });
      try {
        localStorage.setItem(MAP_KEY, id);
      } catch {}
      if (live) setMapId(id);
    })();
    return () => {
      live = false;
    };
  }, [map, t]);

  // what the graph pane says: ready for a word, or what it did with one
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== graph.current?.contentWindow) return;
      const m = e.data as SplitMessage;
      if (m?.type === "jadhr:ready") {
        ready.current = true;
        if (pending.current) {
          graph.current?.contentWindow?.postMessage(pending.current, location.origin);
          pending.current = null;
        }
      } else if (m?.type === "jadhr:word-added") setSaid(t("splitSent", { word: m.word }));
      else if (m?.type === "jadhr:word-refused") setSaid(t(m.reason === "locked" ? "splitLocked" : "versesFailed"));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [t]);

  // the graph pane's map is followed as the reader moves in it, and kept for next time
  const followGraph = useCallback(() => {
    // a new page in the pane: asked whether it holds a map, which answers when it is ready
    ready.current = false;
    graph.current?.contentWindow?.postMessage({ type: "jadhr:ping" } satisfies SplitMessage, location.origin);
    try {
      const at = graph.current?.contentWindow?.location.pathname.match(/\/graph\/edit\/([A-Za-z0-9_-]+)/)?.[1];
      if (at) localStorage.setItem(MAP_KEY, at);
    } catch {}
  }, []);

  const toggle = (which: keyof Panes) =>
    setPanes((p) => {
      if (narrow) return { reader: which === "reader", graph: which === "graph" };
      const next = { ...p, [which]: !p[which] };
      // never both hidden (EDT-316)
      return next.reader || next.graph ? next : p;
    });

  function send() {
    if (!ctx?.word) return;
    setSaid("");
    // the map is shown, as the design's shell did (EDT-319)
    setPanes((p) => (narrow ? { reader: false, graph: true } : { ...p, graph: true }));
    const m: SplitMessage = { type: "jadhr:add-word", slug: ctx.word, at: ctx.at ?? null };
    let inEditor = false;
    try {
      inEditor = /\/graph\/edit\//.test(graph.current?.contentWindow?.location.pathname ?? "");
    } catch {}
    if (inEditor && ready.current) return graph.current?.contentWindow?.postMessage(m, location.origin);
    // the pane is elsewhere (My maps, another page) or still loading: back to the map, sent when it is ready
    pending.current = m;
    if (!inEditor && graph.current && mapId) graph.current.src = `/${locale}/graph/edit/${mapId}`;
  }

  const shown: Panes = narrow && panes.reader && panes.graph ? { reader: true, graph: false } : panes;
  const verse = ctx?.verse ? ctx.verse.split(":").map(Number) : null;
  return (
    <div className="split-view">
      <header className="split-head">
        <Link href="/" className="split-brand" aria-label={t("splitHome")}>
          <span className="editor-mark" aria-hidden="true" />
          <span className="text-[14px] font-semibold text-t1">{t("splitBrand")}</span>
          <span className="text-[12px] text-t3">· {t("splitTitle")}</span>
        </Link>
        <div className="seg-group shrink-0" role="group" aria-label={t("splitPanes")}>
          {(["reader", "graph"] as const).map((k) => (
            <button key={k} type="button" className={"seg" + (shown[k] ? " is-on" : "")} aria-pressed={shown[k]} onClick={() => toggle(k)}>
              {t(k === "reader" ? "splitReader" : "splitGraph")}
            </button>
          ))}
        </div>
        {/* the context: the verse, the word and its root the reader looked up last (EDT-317) */}
        <div className="split-context" role="status" aria-live="polite" aria-label={t("splitContext")}>
          <span className="label-caps max-md:hidden">{t("splitContext")}</span>
          {ctx?.word || ctx?.verse ? (
            <>
              {verse && (
                <span className="split-chip">
                  <span className="dot" style={{ background: "var(--c-sentence)" }} />
                  {names?.get(verse[0]) ? `${names.get(verse[0])} ` : ""}
                  {verseRef(ctx!.verse!, locale)}
                </span>
              )}
              {ctx?.wordAr && (
                <span className="split-chip" dir="auto">
                  <span className="dot" style={{ background: "var(--c-word)" }} />
                  <span className="ar-classical text-[15px]" lang="ar">{ctx.wordAr}</span>
                  {ctx.wordTr && <span className="mono text-[11.5px] text-t3" dir="ltr">· {ctx.wordTr}</span>}
                </span>
              )}
              {ctx?.rootAr && (
                <span className="split-chip">
                  <span className="dot" style={{ background: "var(--c-root)" }} />
                  <span className="ar-classical text-[15px]" lang="ar">{ctx.rootAr}</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-[12.5px] text-t3">{t("splitPick")}</span>
          )}
        </div>
        <button type="button" className="btn btn-primary shrink-0" disabled={!ctx?.word || !mapId} onClick={send}>
          {t("splitSend")}
        </button>
        <ThemeToggle />
      </header>
      <p className="sr-only" role="status" aria-live="polite">{said}</p>
      {said && <p className="split-said" aria-hidden="true">{said}</p>}
      <div className="split-panes">
        <iframe className="split-pane is-reader" title={t("splitReaderFrame")} src={`/${locale}/quran/${surah}`} hidden={!shown.reader} />
        {mapId ? (
          <iframe ref={graph} className="split-pane is-graph" title={t("splitGraphFrame")} src={`/${locale}/graph/edit/${mapId}`} hidden={!shown.graph} onLoad={followGraph} />
        ) : (
          <div className="split-pane is-graph grid place-items-center text-t3" hidden={!shown.graph}>…</div>
        )}
      </div>
    </div>
  );
}
