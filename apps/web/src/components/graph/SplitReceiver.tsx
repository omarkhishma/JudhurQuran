"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { verseRef } from "@/lib/format";
import { lemmaId, rootId, verseId } from "@/lib/graph/build";
import { cleanGraph } from "@/lib/graph/sanitize";
import { rootCards, verseCards, wordCards } from "@/lib/graph/seed";
import type { GraphEdge, GraphNode } from "@/lib/graph/types";
import { useCanvasTools } from "./GraphCanvas";

/** What a page and the map framed in it say to each other — the split view (P8.6) and a lesson's map (P9.3): this
 * page's own origin only. */
export type SplitMessage =
  | { type: "jadhr:add-word"; slug: string; at: string | null }
  | { type: "jadhr:add-verse"; key: string }
  | { type: "jadhr:add-root"; root: string }
  | { type: "jadhr:focus"; id: string }
  | { type: "jadhr:ping" }
  | { type: "jadhr:ready"; editor?: boolean }
  | { type: "jadhr:word-added"; word: string }
  | { type: "jadhr:word-refused"; reason: "locked" | "failed" }
  // a lesson's map: a proposal taken into the open map, and the map handed to the page
  | { type: "jadhr:merge"; ref: string; nodes: GraphNode[]; edges: GraphEdge[]; label: string }
  | { type: "jadhr:merged"; ref: string; cards: number }
  | { type: "jadhr:merge-refused"; ref: string; reason: "locked" }
  | { type: "jadhr:get-doc"; ref: string }
  | { type: "jadhr:doc"; ref: string; nodes: GraphNode[]; edges: GraphEdge[] };

const SLUG = /^[\p{L}\p{N}_.'-]{1,80}$/u;
const PLACE = /^\d{1,3}:\d{1,3}:\d{1,3}$/;
const VERSE = /^\d{1,3}:\d{1,3}$/;
const ROOT = /^[\u0621-\u064a]{1,6}$/;

/**
 * A map framed in a page of this site (P8.6; EDT-319, EDT-323): in the split view's graph pane a word the reader sends
 * is added to the open map — its card with its pattern and part of speech, its root and the verse at its place — as
 * one step undo takes back, without a reload. On a lesson's page (P9.3) a confirmed proposal is taken into the open
 * map the same way, and the map is handed to the page when it asks (a member sending what they added). It says it is
 * ready, whether it edits, and what it did. Heard only from the page that holds this one. Read-only (a shared map
 * read, not edited), it only says it is there, finds a card and hands the map over.
 */
export function SplitReceiver({ readOnly = false, saveNow }: { readOnly?: boolean; saveNow?: (ids: string[]) => Promise<void> }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const tools = useCanvasTools();
  const live = useRef(tools);
  const save = useRef(saveNow);
  useEffect(() => {
    live.current = tools;
    save.current = saveNow;
  });
  useEffect(() => {
    if (window.parent === window) return;
    const reply = (m: SplitMessage) => window.parent.postMessage(m, location.origin);
    const on = async (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const m = e.data as Partial<{ type: string; slug: unknown; at: unknown; key: unknown; root: unknown; ref: unknown }>;
      const ref = typeof m?.ref === "string" ? m.ref.slice(0, 80) : "";
      // the page asks whether a map is here to send to, whichever of the two was ready first
      if (m?.type === "jadhr:ping") return reply({ type: "jadhr:ready", editor: !readOnly && live.current.editable });
      // the map as it is now, for the page to send what was added to it
      if (m?.type === "jadhr:get-doc") return reply({ type: "jadhr:doc", ref, nodes: live.current.nodes.map(({ id, position, data }) => ({ id, position, data }) as GraphNode), edges: live.current.edges.map(({ id, source, target, data }) => ({ id, source, target, data }) as GraphEdge) });
      // following the reading (B45): the card of what the reader looked up, picked when the map holds it — nothing added
      if (m?.type === "jadhr:focus") {
        const id = (e.data as { id?: unknown }).id;
        if (typeof id === "string" && id.length <= 200 && live.current.nodes.some((n) => n.id === id)) {
          live.current.select(id);
          live.current.center(id);
        }
        return;
      }
      if (readOnly) return;
      // a proposal confirmed (P9.3): its cards and links, read as any map is, added in one step
      if (m?.type === "jadhr:merge") {
        const tl = live.current;
        if (!tl.editable) return reply({ type: "jadhr:merge-refused", ref, reason: "locked" });
        const raw = e.data as { nodes?: unknown; edges?: unknown; label?: unknown };
        const had = new Set(tl.nodes.map((n) => n.id));
        const hadLinks = new Set(tl.edges.map((x) => x.id));
        const all = cleanGraph([...tl.nodes, ...(Array.isArray(raw.nodes) ? raw.nodes : [])], [...tl.edges, ...(Array.isArray(raw.edges) ? raw.edges : [])]);
        const nodes = all.nodes.filter((n) => !had.has(n.id));
        const edges = all.edges.filter((x) => !hadLinks.has(x.id));
        tl.addCards(nodes, edges, typeof raw.label === "string" ? raw.label.slice(0, 120) : t("doMergeProposal"));
        if (nodes[0]) {
          const first = nodes[0].id;
          requestAnimationFrame(() => {
            live.current.select(first);
            live.current.center(first);
          });
        }
        // said once kept — in this browser and in the shared copy — so the page may record it and move on
        await save.current?.([...nodes.map((n) => n.id), ...edges.map((x) => x.id)]);
        return reply({ type: "jadhr:merged", ref, cards: nodes.length });
      }
      // a word, or the verse or root of the reader's context (B44)
      const what =
        m?.type === "jadhr:add-word" && typeof m.slug === "string" && SLUG.test(m.slug)
          ? { load: () => wordCards(m.slug as string, typeof m.at === "string" && PLACE.test(m.at) ? m.at : null), id: lemmaId(m.slug) }
          : m?.type === "jadhr:add-verse" && typeof m.key === "string" && VERSE.test(m.key)
            ? { load: async () => ({ ...verseCards(m.key as string), word: verseRef(m.key as string, locale) }), id: verseId(m.key) }
            : m?.type === "jadhr:add-root" && typeof m.root === "string" && ROOT.test(m.root)
              ? { load: async () => rootCards(m.root as string).then((r) => ({ ...r, word: r.name })), id: rootId(m.root) }
              : null;
      if (!what) return;
      const tl = live.current;
      if (!tl.editable) {
        tl.toast(t("splitLocked"));
        return reply({ type: "jadhr:word-refused", reason: "locked" });
      }
      try {
        const got = await what.load();
        const lid = what.id;
        const had = live.current.nodes.some((n) => n.id === lid);
        live.current.addCards(got.nodes, got.edges, t("doSendWord", { word: got.word }));
        // the word picked once the map holds it
        requestAnimationFrame(() => {
          live.current.select(lid);
          live.current.center(lid);
        });
        live.current.toast(t(had ? "splitWordThere" : "splitWordAdded", { word: got.word }), !had);
        reply({ type: "jadhr:word-added", word: got.word });
      } catch {
        live.current.toast(t("versesFailed"));
        reply({ type: "jadhr:word-refused", reason: "failed" });
      }
    };
    window.addEventListener("message", on);
    reply({ type: "jadhr:ready", editor: !readOnly && live.current.editable });
    return () => window.removeEventListener("message", on);
  }, [t, locale, readOnly]);
  // the page is told when this window starts or stops editing (another window took the map, or gave it back)
  const editable = tools.editable;
  useEffect(() => {
    if (window.parent !== window) window.parent.postMessage({ type: "jadhr:ready", editor: !readOnly && editable } satisfies SplitMessage, location.origin);
  }, [editable, readOnly]);
  return null;
}
