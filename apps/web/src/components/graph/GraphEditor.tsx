"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { SignedOut } from "@/lib/account/store";
import { keepVersion } from "@/lib/graph/history";
import { createGraph, fileBase, GRAPHS_SYNCED_EVENT, loadGraph, markShared, putGraph, saveGraphOver, storedAt } from "@/lib/graph/persist";
import { useSharedPresence, useTabLock, type Presence } from "@/lib/graph/presence";
import { isGone, isNewer, readShared, saveShared } from "@/lib/graph/shared";
import type { GraphDoc, GraphEdge, GraphNode, SharedRef } from "@/lib/graph/types";
import { cnt, formatNumber } from "@/lib/format";
import { MAX_MAP_IMPORT, restoreFiles } from "@/lib/graph/files";
import { upgrade } from "@/lib/graph/migrate";
import { cleanTitle } from "@/lib/graph/sanitize";
import { translitOn, useGraphUi } from "@/lib/graph/uiPrefs";
import { useWhereSaved } from "@/lib/graph/whereSaved";
import { SharedMapContext } from "./Comments";
import { Details, DetailsRail } from "./Details";
import { EditorHeader } from "./EditorHeader";
import { EditorHelp } from "./EditorHelp";
import { GraphCanvas, type CanvasTools } from "./GraphCanvas";
import { Library } from "./Library";
import { PresenceBlock } from "./Presence";
import { SplitReceiver } from "./SplitReceiver";
import { ShareDialog } from "./Sharing";

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
  // the soft lock (P8.6, D5): one window edits a map; another is told and may take it. Between this browser's tabs
  // for any map; for a shared one also across the owner's devices, with who else is on it
  const [sharedId, setSharedId] = useState<string | null>(null);
  const gid = sharedId ?? q.data?.shared?.id ?? null;
  const tab = useTabLock(id);
  const { presence, take: takeShared } = useSharedPresence(gid, true);
  const editor = presence?.editor ?? tab.editor;
  const editorRef = useRef(editor);
  const refetch = q.refetch;
  // the edit regained (the other window closed, or this one took it): the latest copy is read before anything is
  // written, so nothing the other window saved is written over
  useEffect(() => {
    if (editorRef.current === "elsewhere" && editor === "you") void refetch();
    editorRef.current = editor;
  }, [editor, refetch]);
  // the window that edits saves: this one follows
  const followSaves = tab.onSaved;
  useEffect(() => followSaves(() => editorRef.current === "elsewhere" && void refetch()), [followSaves, refetch]);
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
      locked={editor === "elsewhere"}
      onTake={() => {
        tab.take();
        takeShared();
      }}
      presence={gid ? presence : null}
      onSaved={tab.saved}
      onSharedChange={setSharedId}
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

type Status = "saved" | "saving" | "unsaved" | "newer" | "gone" | "sharedNewer";
/** The shared copy's state: as saved here, being sent, behind (no connection, or signed out). */
type Push = "idle" | "pushing" | "failed" | "signedOut";

function EditorInner({
  doc,
  from,
  notice,
  reload,
  locked,
  onTake,
  presence,
  onSaved,
  onSharedChange,
}: {
  doc: GraphDoc;
  from?: MapOrigin;
  notice: string | null;
  reload: (quiet: boolean) => Promise<void>;
  /** another window edits this map: this one shows it and saves nothing (P8.6) */
  locked: boolean;
  onTake: () => void;
  presence: Presence | null;
  onSaved: () => void;
  onSharedChange: (id: string | null) => void;
}) {
  const t = useTranslations("graph");
  const lockedRef = useRef(locked);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);
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
  // "the latest copy was opened", said until the reader changes something
  const [fresh, setFresh] = useState(notice);
  // shared for comments (P8.1-E): the server's copy and the revision it was last saved as there
  const [shared, setSharedState] = useState<SharedRef | null>(doc.shared ?? null);
  const sharedRef = useRef<SharedRef | null>(doc.shared ?? null);
  const [push, setPush] = useState<Push>("idle");
  // the map as it was when the share dialog opened (null: closed)
  const [shareDoc, setShareDoc] = useState<GraphDoc | null>(null);
  // writes to this browser's copy one at a time: one that records the shared revision never overtakes a save
  const lane = useRef<Promise<unknown>>(Promise.resolve());
  const laneBusy = useRef(0);
  const inLane = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    laneBusy.current++;
    const run = async () => {
      try {
        return await fn();
      } finally {
        laneBusy.current--;
      }
    };
    const p = lane.current.then(run, run);
    lane.current = p.catch(() => {});
    return p;
  }, []);

  const show = useCallback((s: Status) => {
    statusRef.current = s;
    setStatus(s);
    if (s !== "saved") setFresh(null);
  }, []);
  const halted = useCallback(() => lockedRef.current || statusRef.current === "newer" || statusRef.current === "gone" || statusRef.current === "sharedNewer", []);

  /** The map's link to its shared copy, set or taken off, kept in this browser's copy (and so synced). */
  const setShared = useCallback(
    async (s: SharedRef | null) => {
      sharedRef.current = s;
      setSharedState(s);
      onSharedChange(s?.id ?? null);
      const out = await inLane(() => markShared(doc.id, s, base.current));
      if ("saved" in out) base.current = out.saved;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc.id, inLane],
  );

  // the shared copy follows each save: the whole map, made from the revision last saved there; a newer one there
  // (the owner's other device) stops it and the reader chooses
  const pushing = useRef(false);
  const again = useRef(false);
  const pushShared = useCallback(async () => {
    const s = sharedRef.current;
    if (!s || halted()) return;
    if (pushing.current) {
      again.current = true;
      return;
    }
    pushing.current = true;
    setPush("pushing");
    try {
      const { nodes, edges } = latest.current;
      const out = await saveShared(s.id, { title: titleRef.current || t("untitled"), kind: doc.kind, nodes, edges }, s.revision);
      await setShared({ id: s.id, revision: out.revision });
      setPush("idle");
    } catch (e) {
      if (isNewer(e)) {
        setPush("idle");
        show("sharedNewer");
      } else if (isGone(e)) {
        // stopped from another device: this map is private again
        setPush("idle");
        await setShared(null);
        setFresh(t("shareEndedElsewhere"));
      } else setPush(e instanceof SignedOut ? "signedOut" : "failed");
    } finally {
      pushing.current = false;
      if (again.current) {
        again.current = false;
        void pushShared();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.kind, setShared, show, t]);

  // the latest save, for a timer or a cleanup that outlives the render that set it
  const writeRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const write = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (halted()) return;
    const { nodes, edges } = latest.current;
    const title = titleRef.current;
    const content = contentOf(title, nodes, edges);
    if (content === savedContent.current) return show("saved");
    show("saving");
    const out = await inLane(() => saveGraphOver({ ...doc, pendingLayout: false, title: title || t("untitled"), nodes, edges, shared: sharedRef.current ?? undefined }, base.current));
    if ("conflict" in out) return show(out.conflict);
    base.current = out.saved;
    savedContent.current = content;
    // the other windows on this map follow (P8.6)
    onSaved();
    // a shared map's history is the server's; a private one's is kept here
    if (sharedRef.current) void pushShared();
    else void keepVersion(doc.id, title || t("untitled"), nodes, edges);
    if (contentOf(titleRef.current, latest.current.nodes, latest.current.edges) === content) show("saved");
    else {
      // changed while it was being written: that change is saved in turn
      show("unsaved");
      timer.current = setTimeout(() => void writeRef.current(), 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, t, show, inLane, pushShared, onSaved]);

  // autosave after 800 ms of quiet; a change that is not the reader's (a card measured, one selected) is no change
  const persist = useCallback(
    () => {
      if (halted()) return;
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
    [write, show, halted],
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
    const busy = () => statusRef.current === "saving" || halted() || laneBusy.current > 0;
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
  }, [doc.id, reload, show, halted]);

  async function keepAsNew() {
    const id = await createGraph({ title: t("myCopyTitle", { title: title || t("untitled") }), kind: doc.kind, nodes: latest.current.nodes, edges: latest.current.edges });
    router.push(`/graph/edit/${id}`);
  }

  /** The shared copy, newer there than here (the owner's other device): opened here in place of this one. */
  async function openSharedVersion() {
    const s = sharedRef.current;
    if (!s) return;
    try {
      const got = await readShared(s.id);
      const { nodes, edges } = await upgrade(got.doc.version, got.kind, got.doc.nodes, got.doc.edges);
      await inLane(() => putGraph({ ...doc, title: got.title, kind: got.kind, nodes, edges, pendingLayout: false, shared: { id: got.id, revision: got.revision }, updatedAt: Date.now() }));
      await reload(false);
    } catch {
      setFresh(t("sharedReadFailed"));
    }
  }

  // opened: the shared copy is looked at once — ahead here means the other device saved it and this copy has not
  // caught up; gone means the sharing was stopped elsewhere
  useEffect(() => {
    const s = doc.shared;
    if (!s) {
      // the map as opened is a version of its own; one not yet laid out is kept at its first save
      if (!doc.pendingLayout) void keepVersion(doc.id, doc.title, doc.nodes, doc.edges);
      return;
    }
    let live = true;
    readShared(s.id)
      .then((got) => {
        if (live && got.revision > s.revision) show("sharedNewer");
      })
      .catch((e: unknown) => {
        if (live && isGone(e)) void setShared(null).then(() => setFresh(t("shareEndedElsewhere")));
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // back online, or signed in again: the shared copy catches up
  useEffect(() => {
    const retry = () => {
      if (sharedRef.current && (push === "failed" || push === "signedOut")) void pushShared();
    };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
    };
  }, [push, pushShared]);

  const conflict = status === "newer" || status === "gone" || status === "sharedNewer";
  const openShare = () => setShareDoc({ ...doc, title: titleRef.current || t("untitled"), nodes: latest.current.nodes, edges: latest.current.edges });
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
    <SharedMapContext.Provider value={{ gid: shared?.id ?? null, owner: true, openShare, mapId: doc.id }}>
    <div className="flex min-h-0 flex-1 flex-col">
      <GraphCanvas
        initialNodes={doc.nodes}
        initialEdges={doc.edges}
        autoLayout={!!doc.pendingLayout && !locked}
        editable={!locked}
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
            {/* in the split view's graph pane, the word the reader sends (P8.6) */}
            <SplitReceiver />
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
                  {where && !shared && <span className="hidden shrink-0 text-[12px] text-t3 xl:inline">{t(where === "account" ? "savedAccount" : "localOnly")}</span>}
                  {/* who is on the shared map now (EDT-014) */}
                  {presence && <PresenceBlock presence={presence} />}
                  {/* the shared copy: following each save, or behind and caught up when it can be */}
                  {shared && (
                    <span className="shared-pill shrink-0 text-[12px]" role="status">
                      {push === "failed" || push === "signedOut" ? (
                        <>
                          <span className="text-amber">{t(push === "signedOut" ? "sharedBehindSignedOut" : "sharedBehind")}</span>{" "}
                          {push === "failed" && (
                            <button type="button" className="underline-offset-2 hover:underline" onClick={() => void pushShared()}>{t("retry")}</button>
                          )}
                        </>
                      ) : (
                        <span className="text-t3">{t(push === "pushing" ? "sharedSending" : "sharedOn")}</span>
                      )}
                    </span>
                  )}
                </>
              }
              reader={{ href: readerHref, word: fromWord }}
              onImport={(f, tools) => void importInto(f, tools)}
              onShare={openShare}
              shared={!!shared}
              detailsOpen={detailsOpen}
              onDetails={() => setUi({ detailsOpen: !detailsOpen })}
              onHelp={() => setHelp(true)}
            />
            {locked && (
              <div className="graph-lock" role="status">
                <p className="min-w-0 flex-1 text-[13px] text-t1">{t("lockedElsewhere")}</p>
                <button type="button" className="btn btn-primary" onClick={onTake}>{t("editHere")}</button>
              </div>
            )}
            {conflict && (
              <div className="graph-conflict flex flex-wrap items-center gap-2 border-b border-line px-3 py-2" role="alert">
                <p className="min-w-0 basis-full text-[13px] text-t1 sm:flex-1 sm:basis-auto">{t(status === "gone" ? "conflictGone" : status === "sharedNewer" ? "conflictShared" : "conflictNewer")}</p>
                <button type="button" className="btn btn-primary" onClick={() => void keepAsNew()}>{t("keepAsNew")}</button>
                {status === "sharedNewer" ? (
                  <button type="button" className="btn" onClick={() => void openSharedVersion()}>{t("openSharedVersion")}</button>
                ) : status === "newer" ? (
                  <button type="button" className="btn" onClick={() => void reload(false)}>{t("openNewer")}</button>
                ) : (
                  <Link href="/graph" className="btn">{t("editorTitle")}</Link>
                )}
              </div>
            )}
          </>
        }
        // the library adds to the map: not while another window edits it
        start={locked ? undefined : <Library kind={doc.kind} onPick={() => {}} pendingDrop={pendingDrop} setPendingDrop={setPendingDrop} onHelp={() => setHelp(true)} />}
        end={detailsOpen ? <Details title={title} /> : <DetailsRail />}
      />
      <EditorHelp open={help} onClose={() => setHelp(false)} />
      {shareDoc && (
        <ShareDialog
          open
          onClose={() => setShareDoc(null)}
          doc={shareDoc}
          shared={shared}
          onShared={(s) => void setShared(s)}
          onStopped={() => void setShared(null)}
        />
      )}
    </div>
    </SharedMapContext.Provider>
  );
}
