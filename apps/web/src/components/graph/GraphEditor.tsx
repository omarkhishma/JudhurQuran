"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createGraph, encodeShare, GRAPHS_SYNCED_EVENT, loadGraph, newId, saveGraphOver, storedAt } from "@/lib/graph/persist";
import type { GraphDoc, GraphEdge, GraphNode } from "@/lib/graph/types";
import type { SearchResult, WordDetail } from "@/lib/types";
import { useDebounced } from "@/lib/useDebounced";
import { formatNumber, verseRef } from "@/lib/format";
import { GraphCanvas } from "./GraphCanvas";

type AddFn = (nodes: GraphNode[], edges: GraphEdge[], label: string) => void;

/** What autosave compares: the map as the reader made it — not the sizes xyflow measures, nor what is selected. */
const contentOf = (title: string, nodes: GraphNode[], edges: GraphEdge[]) =>
  JSON.stringify([title, nodes.map((n) => [n.id, Math.round(n.position.x), Math.round(n.position.y), n.data]), edges.map((e) => [e.id, e.source, e.target, e.data?.label ?? ""])]);

export function GraphEditor({ id }: { id: string }) {
  const t = useTranslations("graph");
  // read afresh on every opening — a copy kept from an earlier visit would be written back over newer work (F1)
  const q = useQuery({ queryKey: ["graph", id], queryFn: async () => (await loadGraph(id)) ?? null, gcTime: 0, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const [notice, setNotice] = useState<string | null>(null);
  if (q.isPending) return <p className="p-6 text-t3">…</p>;
  if (!q.data) return <p className="p-6 text-t2">{t("noGraphs")} <Link href="/graph" className="text-word underline">{t("editorTitle")}</Link></p>;
  return (
    <EditorInner
      key={q.dataUpdatedAt}
      doc={q.data}
      notice={notice}
      reload={async (quiet) => {
        await q.refetch();
        setNotice(quiet ? t("reloadedNewer") : null);
      }}
    />
  );
}

type Status = "saved" | "saving" | "unsaved" | "newer" | "gone";

function EditorInner({ doc, notice, reload }: { doc: GraphDoc; notice: string | null; reload: (quiet: boolean) => Promise<void> }) {
  const t = useTranslations("graph");
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  // the title as typed, read by a save scheduled before the next render
  const titleRef = useRef(doc.title);
  const [status, setStatus] = useState<Status>("saved");
  const latest = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: doc.nodes, edges: doc.edges });
  const addRef = useRef<AddFn | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // the stored copy this editor opened or last wrote, and what it holds; a map waiting for its first layout is
  // written once laid out
  const base = useRef(doc.updatedAt);
  const savedContent = useRef(doc.pendingLayout ? "" : contentOf(doc.title, doc.nodes, doc.edges));
  const statusRef = useRef<Status>("saved");
  const [copied, setCopied] = useState(false);
  // "the latest copy was opened", said until the reader changes something
  const [fresh, setFresh] = useState(notice);

  const show = useCallback((s: Status) => {
    statusRef.current = s;
    setStatus(s);
    if (s !== "saved") setFresh(null);
  }, []);

  // the latest save, for a timer or a cleanup that outlives the render that set it
  const writeRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const write = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (statusRef.current === "newer" || statusRef.current === "gone") return;
    const { nodes, edges } = latest.current;
    const title = titleRef.current;
    const content = contentOf(title, nodes, edges);
    if (content === savedContent.current) return show("saved");
    show("saving");
    const out = await saveGraphOver({ ...doc, pendingLayout: false, title: title || t("untitled"), nodes, edges }, base.current);
    if ("conflict" in out) return show(out.conflict);
    base.current = out.saved;
    savedContent.current = content;
    if (contentOf(titleRef.current, latest.current.nodes, latest.current.edges) === content) show("saved");
    else {
      // changed while it was being written: that change is saved in turn
      show("unsaved");
      timer.current = setTimeout(() => void writeRef.current(), 800);
    }
  }, [doc, t, show]);

  // autosave after 800 ms of quiet; a change that is not the reader's (a card measured, one selected) is no change
  const persist = useCallback(
    () => {
      if (statusRef.current === "newer" || statusRef.current === "gone") return;
      if (statusRef.current === "saving") return; // the save under way looks again when it ends
      if (contentOf(titleRef.current, latest.current.nodes, latest.current.edges) === savedContent.current) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        if (statusRef.current === "unsaved") show("saved");
        return;
      }
      show("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void write(), 800);
    },
    [write, show],
  );

  // leaving the editor, or the page, writes what is pending at once
  useEffect(() => {
    writeRef.current = write;
  });
  useEffect(() => {
    const away = () => {
      if (document.visibilityState === "hidden" && timer.current) void writeRef.current();
    };
    document.addEventListener("visibilitychange", away);
    return () => {
      document.removeEventListener("visibilitychange", away);
      if (timer.current) void writeRef.current();
    };
  }, []);

  // a newer copy written elsewhere (another tab, a hand-off into this map, sync): opened at once when nothing here
  // is unsaved, else the reader is asked
  useEffect(() => {
    const busy = () => statusRef.current === "saving" || statusRef.current === "newer" || statusRef.current === "gone";
    const check = async () => {
      if (document.visibilityState !== "visible" || busy()) return;
      const at = await storedAt(doc.id);
      if (busy() || at === base.current) return;
      if (at == null) return show("gone");
      if (statusRef.current === "saved") void reload(true);
      else show("newer");
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    window.addEventListener(GRAPHS_SYNCED_EVENT, check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener(GRAPHS_SYNCED_EVENT, check);
    };
  }, [doc.id, reload, show]);

  async function keepAsNew() {
    const id = await createGraph({ title: t("myCopyTitle", { title: title || t("untitled") }), kind: doc.kind, nodes: latest.current.nodes, edges: latest.current.edges });
    router.push(`/graph/edit/${id}`);
  }

  async function share() {
    const code = encodeShare({ ...doc, title, nodes: latest.current.nodes, edges: latest.current.edges });
    const url = `${window.location.origin}${window.location.pathname.startsWith("/en") ? "/en" : ""}/graph/view#${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  const conflict = status === "newer" || status === "gone";
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <Palette onAdd={(n, e, label) => addRef.current?.(n, e, label)} kind={doc.kind} />
      <div className="flex min-h-0 flex-1 flex-col">
        {conflict && (
          <div className="graph-conflict flex flex-wrap items-center gap-2 border-b border-line px-3 py-2" role="alert">
            <p className="min-w-0 basis-full text-[13px] text-t1 sm:flex-1 sm:basis-auto">{t(status === "gone" ? "conflictGone" : "conflictNewer")}</p>
            <button type="button" className="btn btn-primary" onClick={() => void keepAsNew()}>{t("keepAsNew")}</button>
            {status === "newer" ? (
              <button type="button" className="btn" onClick={() => void reload(false)}>{t("openNewer")}</button>
            ) : (
              <Link href="/graph" className="btn">{t("editorTitle")}</Link>
            )}
          </div>
        )}
        <GraphCanvas
          initialNodes={doc.nodes}
          initialEdges={doc.edges}
          autoLayout={!!doc.pendingLayout}
          editable
          title={title}
          onTitleChange={(v) => {
            titleRef.current = v;
            setTitle(v);
            persist();
          }}
          onChange={(nodes, edges) => {
            latest.current = { nodes, edges };
            persist();
          }}
          registerAdd={(fn) => (addRef.current = fn)}
          fileName={`map-${doc.id}`}
          status={
            <span className="flex items-center gap-1.5 text-[12px] text-t3" aria-live="polite">
              <span className="dot" style={{ background: status === "saved" ? "var(--good)" : "var(--amber)" }} />
              {status === "saved" ? fresh ?? t("saved") : status === "saving" ? t("saving") : t("unsaved")}
              <span className="hidden sm:inline">• {t("localOnly")}</span>
            </span>
          }
          toolbarExtra={
            <button type="button" className="btn" onClick={() => void share()} aria-live="polite">
              {copied ? t("shareCopied") : t("share")}
            </button>
          }
        />
      </div>
    </div>
  );
}

function Palette({ onAdd, kind }: { onAdd: AddFn; kind: GraphDoc["kind"] }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 200);
  const { data } = useQuery({
    queryKey: ["palette-search", dq],
    enabled: dq.length > 0,
    queryFn: async () => (await (await fetch(`/api/v1/search?q=${encodeURIComponent(dq)}&limit=6`)).json()) as SearchResult,
  });

  async function addWord(location: string) {
    const w = (await (await fetch(`/api/v1/words/${location}`)).json()) as WordDetail;
    onAdd(
      [
        {
          id: `word:${location}`,
          type: "card",
          position: { x: 0, y: 0 },
          data: {
            kind: "word",
            sub: w.text_imlaei,
            count: w.occurrences.form,
            rootKey: w.root?.key,
            lemmaId: w.lemma?.id,
            form: w.text_imlaei,
            verse: { key: w.verse.key, location },
          },
        },
      ],
      [],
      t("doAddWord", { word: w.text_imlaei }),
    );
  }

  function addVerse(key: string) {
    onAdd(
      [{ id: `verse:${key}`, type: "card", position: { x: 0, y: 0 }, data: { kind: "verse", ar: key, verse: { key } } }],
      [],
      t("doAddVerse", { ref: verseRef(key, locale) }),
    );
  }

  return (
    <aside className="flex max-h-[42dvh] w-full shrink-0 flex-col border-b border-line bg-panel md:max-h-none md:w-[300px] md:border-b-0 md:border-e" aria-label={t("palette")}>
      <div className="border-b border-line p-3">
        <p className="label-caps mb-2">{t("palette")}</p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("addSearch")}
          aria-label={t("addSearch")}
          className="h-10 w-full rounded-lg border border-line bg-card px-3 text-[14px] outline-none focus:border-ring"
        />
        <button
          type="button"
          className="btn mt-2 w-full"
          onClick={() =>
            onAdd([{ id: `note:${newId()}`, type: "card", position: { x: 0, y: 0 }, data: { kind: "note", text: "" } }], [], t("doAddNote"))
          }
        >
          <span className="dot" style={{ background: "var(--c-desc)" }} />
          {t("addNote")}
        </button>
        {kind === "meaning" && <p className="mt-2 text-[11.5px] leading-snug text-t3">{t("meaningHint")}</p>}
        <p className="mt-2 text-[11.5px] leading-snug text-t3">{t("connectHint")}</p>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {data?.results.roots.map((r) => (
          <li key={`r${r.key}`}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-start hover:bg-card"
              onClick={() =>
                onAdd(
                  [{ id: `root:${r.key}`, type: "card", position: { x: 0, y: 0 }, data: { kind: "root", ar: r.spaced, sub: r.translit, count: r.occurrences, rootKey: r.key } }],
                  [],
                  t("doAddRoot", { root: locale === "ar" ? r.spaced : r.translit }),
                )
              }
            >
              <span className="flex items-center gap-2"><span className="dot" style={{ background: "var(--c-root)" }} /><span className="ar-classical text-[18px] text-root" lang="ar">{r.spaced}</span></span>
              <span className="mono text-[11px] text-t3">{formatNumber(r.occurrences, locale)}</span>
            </button>
          </li>
        ))}
        {data?.results.words.map((w) => (
          <li key={`w${w.form}-${w.lemma_id}`}>
            <button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-start hover:bg-card" onClick={() => void addWord(w.sample)}>
              <span className="flex items-center gap-2"><span className="dot" style={{ background: "var(--c-word)" }} /><span className="ar-classical text-[18px]" lang="ar">{w.display}</span></span>
              <span className="mono text-[11px] text-t3">{formatNumber(w.occurrences, locale)}</span>
            </button>
          </li>
        ))}
        {data?.results.verses.slice(0, 4).map((v) => (
          <li key={`v${v.key}`}>
            <button type="button" className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-start hover:bg-card" onClick={() => addVerse(v.key)}>
              <span className="dot mt-3" style={{ background: "var(--c-sentence)" }} />
              <span className="min-w-0">
                <span className="quran line-clamp-2 text-[16px] leading-[2]" lang="ar">{v.text_qpc}</span>
                <span className="text-[11px] text-t3">{v.name_ar}: {formatNumber(v.ayah, locale)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
