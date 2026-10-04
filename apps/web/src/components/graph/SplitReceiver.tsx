"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { verseRef } from "@/lib/format";
import { lemmaId, rootId, verseId } from "@/lib/graph/build";
import { rootCards, verseCards, wordCards } from "@/lib/graph/seed";
import { useCanvasTools } from "./GraphCanvas";

/** What the split view's page and its graph pane say to each other (P8.6): this page's own origin only. */
export type SplitMessage =
  | { type: "jadhr:add-word"; slug: string; at: string | null }
  | { type: "jadhr:add-verse"; key: string }
  | { type: "jadhr:add-root"; root: string }
  | { type: "jadhr:focus"; id: string }
  | { type: "jadhr:ping" } | { type: "jadhr:ready" } | { type: "jadhr:word-added"; word: string } | { type: "jadhr:word-refused"; reason: "locked" | "failed" };

const SLUG = /^[\p{L}\p{N}_.'-]{1,80}$/u;
const PLACE = /^\d{1,3}:\d{1,3}:\d{1,3}$/;
const VERSE = /^\d{1,3}:\d{1,3}$/;
const ROOT = /^[\u0621-\u064a]{1,6}$/;

/**
 * The editor in the split view's graph pane (P8.6; EDT-319, EDT-323): a word the reader sends is added to the open
 * map — its card with its pattern and part of speech, its root and the verse at its place — as one step undo takes
 * back, without a reload; it says it is ready, and what it did. Heard only from the page that holds this one.
 */
export function SplitReceiver() {
  const t = useTranslations("graph");
  const locale = useLocale();
  const tools = useCanvasTools();
  const live = useRef(tools);
  useEffect(() => {
    live.current = tools;
  });
  useEffect(() => {
    if (window.parent === window) return;
    const reply = (m: SplitMessage) => window.parent.postMessage(m, location.origin);
    const on = async (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const m = e.data as Partial<{ type: string; slug: unknown; at: unknown; key: unknown; root: unknown }>;
      // the page asks whether a map is here to send to, whichever of the two was ready first
      if (m?.type === "jadhr:ping") return reply({ type: "jadhr:ready" });
      // following the reading (B45): the card of what the reader looked up, picked when the map holds it — nothing added
      if (m?.type === "jadhr:focus") {
        const id = (e.data as { id?: unknown }).id;
        if (typeof id === "string" && id.length <= 200 && live.current.nodes.some((n) => n.id === id)) {
          live.current.select(id);
          live.current.center(id);
        }
        return;
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
    reply({ type: "jadhr:ready" });
    return () => window.removeEventListener("message", on);
  }, [t, locale]);
  return null;
}
