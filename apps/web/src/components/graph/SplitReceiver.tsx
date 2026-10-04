"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { lemmaId } from "@/lib/graph/build";
import { wordCards } from "@/lib/graph/seed";
import { useCanvasTools } from "./GraphCanvas";

/** What the split view's page and its graph pane say to each other (P8.6): this page's own origin only. */
export type SplitMessage = { type: "jadhr:add-word"; slug: string; at: string | null } | { type: "jadhr:ping" } | { type: "jadhr:ready" } | { type: "jadhr:word-added"; word: string } | { type: "jadhr:word-refused"; reason: "locked" | "failed" };

const SLUG = /^[\p{L}\p{N}_.'-]{1,80}$/u;
const PLACE = /^\d{1,3}:\d{1,3}:\d{1,3}$/;

/**
 * The editor in the split view's graph pane (P8.6; EDT-319, EDT-323): a word the reader sends is added to the open
 * map — its card with its pattern and part of speech, its root and the verse at its place — as one step undo takes
 * back, without a reload; it says it is ready, and what it did. Heard only from the page that holds this one.
 */
export function SplitReceiver() {
  const t = useTranslations("graph");
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
      const m = e.data as Partial<{ type: string; slug: unknown; at: unknown }>;
      // the page asks whether a map is here to send to, whichever of the two was ready first
      if (m?.type === "jadhr:ping") return reply({ type: "jadhr:ready" });
      if (m?.type !== "jadhr:add-word" || typeof m.slug !== "string" || !SLUG.test(m.slug)) return;
      const at = typeof m.at === "string" && PLACE.test(m.at) ? m.at : null;
      const tl = live.current;
      if (!tl.editable) {
        tl.toast(t("splitLocked"));
        return reply({ type: "jadhr:word-refused", reason: "locked" });
      }
      try {
        const got = await wordCards(m.slug, at);
        const lid = lemmaId(m.slug);
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
  }, [t]);
  return null;
}
