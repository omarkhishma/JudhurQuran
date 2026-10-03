"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { createGraph, encodeShare, fileBase, GRAPHS_SYNCED_EVENT, loadGraph, saveGraphOver, storedAt } from "@/lib/graph/persist";
import type { GraphDoc, GraphEdge, GraphNode } from "@/lib/graph/types";
import { cnt, formatNumber } from "@/lib/format";
import { MAX_MAP_IMPORT, restoreFiles } from "@/lib/graph/files";
import { upgrade } from "@/lib/graph/migrate";
import { cleanTitle } from "@/lib/graph/sanitize";
import { translitOn, useGraphUi } from "@/lib/graph/uiPrefs";
import { useWhereSaved } from "@/lib/graph/whereSaved";
import { Details } from "./Details";
import { EditorHeader } from "./EditorHeader";
import { EditorHelp } from "./EditorHelp";
import { GraphCanvas, type CanvasTools } from "./GraphCanvas";
import { Library } from "./Library";

/** What autosave compares: the map as the reader made it — not the sizes xyflow measures, nor what is selected. */
const contentOf = (title: string, nodes: GraphNode[], edges: GraphEdge[]) =>
  JSON.stringify([title, nodes.map((n) => [n.id, Math.round(n.position.x), Math.round(n.position.y), n.data]), edges.map((e) => [e.id, e.source, e.target, e.data?.label ?? ""])]);

/** The word the map was made from, when it was (`?w=&at=` from the hand-off), for the way back to the reader. */
export type MapOrigin = { w?: string; at?: string };

export function GraphEditor({ id, from }: { id: string; from?: MapOrigin }) {
  const t = useTranslations("graph");
  // read afresh on every opening — a copy kept from an earlier visit would be written back over newer work (F1)
  const q = useQuery({ queryKey: ["graph", id], queryFn: async () => (await loadGraph(id)) ?? null, gcTime: 0, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const [notice, setNotice] = useState<string | null>(null);
  if (q.isPending) return <p className="p-6 text-t3">…</p>;
  if (!q.data) return <MissingMap id={id} refetch={() => void q.refetch()} />;
  return (
    <EditorInner
      key={q.dataUpdatedAt}
      doc={q.data}
      from={from}
      notice={notice}
      reload={async (quiet) => {
        await q.refetch();
        setNotice(quiet ? t("reloadedNewer") : null);
      }}
    />
  );
}

/** A map that is not in this browser (F11): why that may be, and what the reader can do — sign in if it is with an
 * account, or wait for sync to bring it, which opens it here when it arrives. */
function MissingMap({ id, refetch }: { id: string; refetch: () => void }) {
  const t = useTranslations("graph");
  const where = useWhereSaved();
  useEffect(() => {
    window.addEventListener(GRAPHS_SYNCED_EVENT, refetch);
    return () => window.removeEventListener(GRAPHS_SYNCED_EVENT, refetch);
  }, [refetch]);
  return (
    <div className="mx-auto flex max-w-[560px] flex-1 flex-col items-start justify-center gap-3 px-4 py-16">
      <h1 className="text-[20px] font-semibold">{t("mapMissing")}</h1>
      {where && <p className="text-[14px] leading-relaxed text-t2">{t(where === "account" ? "mapMissingAccount" : "mapMissingBrowser")}</p>}
      <div className="flex flex-wrap gap-2">
        <Link href="/graph" className="btn btn-primary min-h-[40px]">{t("editorTitle")}</Link>
        {where === "browser" && (
          <Link href={`/signin?next=${encodeURIComponent(`/graph/edit/${id}`)}`} className="btn min-h-[40px]">{t("signInForMaps")}</Link>
        )}
      </div>
    </div>
  );
}

type Status = "saved" | "saving" | "unsaved" | "newer" | "gone";

function EditorInner({ doc, from, notice, reload }: { doc: GraphDoc; from?: MapOrigin; notice: string | null; reload: (quiet: boolean) => Promise<void> }) {
  const t = useTranslations("graph");
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  // the title as typed, read by a save scheduled before the next render
  const titleRef = useRef(doc.title);
  const [status, setStatus] = useState<Status>("saved");
  const latest = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: doc.nodes, edges: doc.edges });
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
  const where = useWhereSaved();
  const locale = useLocale();
  const detailsOpen = useGraphUi((u) => u.detailsOpen);
  const translit = translitOn(useGraphUi((u) => u.translit), locale);
  const setUi = useGraphUi((u) => u.set);
  const [help, setHelp] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{ x: number; y: number } | null>(null);

  // back to the reader, at the word the map was made from when it was (EDT-020)
  const fromWord = from?.w ? doc.nodes.find((n) => n.id === `lemma:${from.w}`)?.data.ar ?? null : null;
  const readerHref = from?.w && from.at ? `/quran/${from.at.split(":")[0]}?w=${encodeURIComponent(from.w)}&at=${from.at}` : from?.w ? `/read?w=${encodeURIComponent(from.w)}` : "/read";

  /** A file read into this map (EDT-260): its cards in place of these, in one undoable step, its title kept. */
  async function importInto(file: File, tools: CanvasTools) {
    if (file.size > MAX_MAP_IMPORT) return tools.toast(t("importTooLarge"));
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return tools.toast(t("importNotJson"));
    }
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (!Array.isArray(o.nodes)) return tools.toast(t("importNoNodes"));
    try {
      const got = await upgrade(o.version, doc.kind, o.nodes, o.edges);
      await restoreFiles(o.files, got.nodes);
      const fileTitle = cleanTitle(o.title, "");
      if (fileTitle) {
        titleRef.current = fileTitle;
        setTitle(fileTitle);
      }
      tools.importCards(got.nodes, got.edges, t("doImport"));
      const skipped = got.skippedNodes + got.skippedEdges;
      tools.toast(t("importedReport", { cards: t("cards", cnt(got.nodes.length, locale)), links: t("links", cnt(got.edges.length, locale)) }) + (skipped ? t("importSkipped", { n: formatNumber(skipped, locale) }) : ""), true);
    } catch {
      tools.toast(t("importOffline"));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GraphCanvas
        initialNodes={doc.nodes}
        initialEdges={doc.edges}
        autoLayout={!!doc.pendingLayout}
        editable
        title={title}
        translit={translit}
        onChange={(nodes, edges) => {
          latest.current = { nodes, edges };
          persist();
        }}
        fileName={fileBase(title || t("untitled"))}
        kind={doc.kind}
        onHelp={() => setHelp(true)}
        onDropPayload={(payload, at) => {
          try {
            window.dispatchEvent(new CustomEvent("jadhr:library-drop", { detail: { payload: JSON.parse(payload), at } }));
          } catch {}
        }}
        header={
          <>
            <EditorHeader
              title={title}
              onTitle={(v) => {
                titleRef.current = v;
                setTitle(v);
                persist();
              }}
              status={
                <>
                  {/* the save pill (EDT-015): announced politely, green once saved */}
                  <span className="save-pill shrink-0" role="status" aria-live="polite">
                    <span className="dot" style={{ background: status === "saved" ? "var(--good)" : conflict ? "var(--amber)" : "var(--ring)" }} />
                    {status === "saved" ? fresh ?? t("saved") : status === "saving" ? t("saving") : t("unsaved")}
                  </span>
                  {where && <span className="hidden shrink-0 text-[12px] text-t3 xl:inline">{t(where === "account" ? "savedAccount" : "localOnly")}</span>}
                </>
              }
              reader={{ href: readerHref, word: fromWord }}
              onImport={(f, tools) => void importInto(f, tools)}
              onShare={() => void share()}
              shareCopied={copied}
              detailsOpen={detailsOpen}
              onDetails={() => setUi({ detailsOpen: !detailsOpen })}
              onHelp={() => setHelp(true)}
            />
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
          </>
        }
        start={<Library kind={doc.kind} onPick={() => {}} pendingDrop={pendingDrop} setPendingDrop={setPendingDrop} onHelp={() => setHelp(true)} />}
        end={detailsOpen ? <Details title={title} /> : null}
      />
      <EditorHelp open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
