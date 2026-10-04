"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Link, useRouter } from "@/i18n/navigation";
import { upgrade } from "@/lib/graph/migrate";
import { forkPublished, publishedPath, type PublishedMap } from "@/lib/graph/published";
import type { GraphNode } from "@/lib/graph/types";
import { freezeGraphUi, translitOn, useGraphUi } from "@/lib/graph/uiPrefs";
import { SharedMapContext } from "./Comments";
import { Details, DetailsRail } from "./Details";
import { EditorHelp } from "./EditorHelp";
import { GraphCanvas, useCanvasTools } from "./GraphCanvas";

/** What a frame around a map is told of a card selected or folded in it (EDT-286, EDT-287, HWF-32): `type2` names
 * the card's kind, since `type` names the message. */
export type CardMessage = { type: "jadhr-card"; id: string; ar: string; tr: string; type2: string; folded: boolean; root: string | null; slug: string | null };

/**
 * A published version read in the editor itself, read-only (EDT-275…289, HWF-11): the author's arrangement as they
 * published it, every card selectable and foldable, Meaning and Settings beside it; nothing can be changed, and an
 * attempt is told; nothing the reader keeps is written (the panels follow the address). `framed` is the embed: no
 * header, the details closed or open as the address says, and the messages of its frame.
 */
export function ReadOnlyMap({ m, framed, entry, folded, header }: { m: PublishedMap; framed: boolean; entry: boolean; folded: boolean; header?: React.ReactNode }) {
  const t = useTranslations("graph");
  const translit = translitOn(useGraphUi((u) => u.translit), useLocale());
  const detailsOpen = useGraphUi((u) => u.detailsOpen);
  // read as any stored map is: cleaned, a version-1 document migrated, both shapes of link accepted (EDT-277)
  const q = useQuery({
    queryKey: ["published-doc", m.slug, m.version],
    queryFn: async () => {
      const got = await upgrade(m.doc.version ?? m.doc_version, m.kind, m.doc.nodes, m.doc.edges);
      // `folded=1` opens every card folded to its headline (EDT-280)
      return { nodes: folded ? got.nodes.map((n) => (n.data.kind === "frame" ? n : { ...n, data: { ...n.data, folded: true } })) : got.nodes, edges: got.edges };
    },
    staleTime: Infinity,
  });
  // nothing the reader keeps is written while the map is read; its details open or closed as the address says
  useEffect(() => {
    const unfreeze = freezeGraphUi();
    useGraphUi.setState({ detailsOpen: entry });
    return unfreeze;
  }, [entry]);
  if (!q.data) return <p className="p-6 text-t3">…</p>;
  return (
    <SharedMapContext.Provider value={{ gid: null, owner: false, published: true }}>
      {/* the map's title as its document's heading, for screen readers: a frame is a document of its own */}
      <h1 className="sr-only">{m.title}</h1>
      <div className="flex min-h-0 flex-1 flex-col">
        <GraphCanvas
          initialNodes={q.data.nodes}
          initialEdges={q.data.edges}
          title={m.title}
          kind={m.kind}
          translit={translit}
          guard={t("publishedGuard")}
          draggable={false}
          // framed, no header at all (EDT-284): not even the canvas's own toolbar
          header={header ?? <></>}
          end={
            <>
              {framed && <FrameBridge />}
              {detailsOpen ? <Details title={m.title} /> : <DetailsRail />}
            </>
          }
        />
      </div>
    </SharedMapContext.Provider>
  );
}

/** The parent window's origin, when this page is framed by one: messages go only there, and come only from there. */
function parentOrigin(): string | null {
  if (typeof window === "undefined" || window.parent === window) return null;
  try {
    return document.referrer ? new URL(document.referrer).origin : null;
  } catch {
    return null;
  }
}

/**
 * The embed's messages (EDT-285…287, HWF-56): in, from its parent window only — fit, fold every card, the theme
 * (applied, never kept); out, to its parent's origin only — the card selected, or folded or unfolded, by any way.
 */
function FrameBridge() {
  const tools = useCanvasTools();
  const origin = useRef<string | null>(null);
  const toolsRef = useRef(tools);
  useEffect(() => {
    toolsRef.current = tools;
  });
  useEffect(() => {
    origin.current = parentOrigin();
    const on = (e: MessageEvent) => {
      if (e.source !== window.parent || (origin.current && e.origin !== origin.current)) return;
      const d = (e.data && typeof e.data === "object" ? e.data : {}) as Record<string, unknown>;
      const now = toolsRef.current;
      if (d.type === "jadhr-fit") now.fit();
      else if (d.type === "jadhr-fold" && typeof d.folded === "boolean")
        now.foldTo(
          now.nodes.filter((n) => n.data.kind !== "frame").map((n) => n.id),
          d.folded,
        );
      else if (d.type === "jadhr-theme" && typeof d.dark === "boolean") document.documentElement.dataset.theme = d.dark ? "dark" : "light";
    };
    window.addEventListener("message", on);
    // listening now: the parent may tell its display (a message sent before this would have been lost)
    if (origin.current) window.parent.postMessage({ type: "jadhr-ready" }, origin.current);
    return () => window.removeEventListener("message", on);
  }, []);
  // the card selected, and any card whose fold changed, told to the parent as it happens
  const sel = tools.selected.length === 1 ? tools.selected[0] : null;
  const foldKey = tools.nodes.map((n) => (n.data.folded ? "1" : "0")).join("");
  const lastFold = useRef<Map<string, boolean> | null>(null);
  useEffect(() => {
    const to = origin.current;
    const was = lastFold.current;
    lastFold.current = new Map(tools.nodes.map((n) => [n.id, !!n.data.folded]));
    if (!to) return;
    const send = (n: GraphNode) => {
      const msg: CardMessage = { type: "jadhr-card", id: n.id, ar: n.data.ar ?? n.data.title ?? n.data.verse?.key ?? "", tr: n.data.sub ?? "", type2: n.data.kind, folded: !!n.data.folded, root: n.data.rootKey ?? null, slug: n.data.slug ?? null };
      window.parent.postMessage(msg, to);
    };
    const toggled = was ? tools.nodes.filter((n) => was.has(n.id) && was.get(n.id) !== !!n.data.folded) : [];
    if (toggled.length === 1) send(toggled[0]);
    else if (sel) send(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id, foldKey]);
  return null;
}

/**
 * The editor's read-only header (EDT-025…027, EDT-030, EDT-283): the mark, the map's title back to its page, the pill
 * that says it is published and read-only, Fold · Unfold · Fit, Fork, the details, the theme and the keys.
 */
export function PublishedHeader({ m }: { m: PublishedMap }) {
  const t = useTranslations("graph");
  const tools = useCanvasTools();
  const router = useRouter();
  const detailsOpen = useGraphUi((u) => u.detailsOpen);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const cards = tools.nodes.filter((n) => n.data.kind !== "frame").map((n) => n.id);
  async function fork() {
    setBusy(true);
    try {
      const id = await forkPublished(m, t("forkTitle", { title: m.title }));
      router.push(`/graph/edit/${id}?forked=1`);
    } catch {
      tools.toast(t("forkFailed"));
      setBusy(false);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const at = e.target as HTMLElement;
      if (at.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "?") setHelp(true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <header className="editor-header is-published" aria-label={t("editorHeader")}>
      <span className="editor-mark" aria-hidden="true" />
      <Link href={publishedPath(m.slug, m.version < m.latest ? m.version : undefined)} className="btn shrink-0" title={t("publishedBackTitle")}>
        <Icon name="chevronStart" />
        <span className="max-w-[28ch] truncate">{m.title}</span>
      </Link>
      <span className="published-pill shrink-0">{t("publishedPill")}</span>
      <span className="flex-1" />
      <div className="seg-group shrink-0">
        <button type="button" className="seg" onClick={() => tools.foldTo(cards, true)} title={t("foldEveryHint")}>{t("foldAll")}</button>
        <button type="button" className="seg" onClick={() => tools.foldTo(cards, false)} title={t("unfoldEveryHint")}>{t("unfoldAll")}</button>
        <button type="button" className="seg" onClick={tools.fit} aria-keyshortcuts="F" title={t("fitHint")}>{t("fit")}</button>
      </div>
      <button type="button" className="btn btn-primary shrink-0" onClick={() => void fork()} disabled={busy}>{t("forkAction")}</button>
      <button type="button" className="btn shrink-0 max-md:hidden" aria-pressed={detailsOpen} onClick={() => useGraphUi.setState({ detailsOpen: !detailsOpen })} title={t("detailsToggle")}>
        {t("details")}
      </button>
      <ThemeToggle />
      <button type="button" className="btn icon-btn shrink-0" onClick={() => setHelp(true)} aria-label={t("helpLabel")} title={t("helpTitle")} aria-keyshortcuts="?">
        ?
      </button>
      <EditorHelp open={help} onClose={() => setHelp(false)} />
    </header>
  );
}
