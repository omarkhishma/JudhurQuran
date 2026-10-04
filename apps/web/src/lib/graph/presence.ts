"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "@/lib/account/store";

/**
 * Presence and the soft lock (P8.6, D5; EDT-014, EDT-296, EDT-297). A shared map: who is on it now, over the API's
 * WebSocket — the signed-in by their name, others counted — and which of its owner's windows edits it. A private
 * map: the same lock between this browser's tabs, over a BroadcastChannel; nothing leaves the browser. Neither is
 * kept anywhere. The lock is advisory: a save still never goes over a newer copy (F1, P8.1-E).
 */

export type Person = { name: string | null; owner: boolean; you: boolean; windows: number; editing?: boolean };
export type Presence = { people: Person[]; guests: number; editor: "you" | "elsewhere" | null };

/** Who is on a shared map, kept up to date while the window is open; `editing` says this window means to edit (the
 * owner's editor) rather than read. `take` claims the map for this window. */
export function useSharedPresence(gid: string | null, editing: boolean): { presence: Presence | null; take: () => void } {
  const session = useAccount((s) => s.session);
  const [presence, setPresence] = useState<Presence | null>(null);
  const sock = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!gid || typeof WebSocket === "undefined") return;
    let closed = false;
    let wait = 1000;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const open = () => {
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/v1/graphs/${encodeURIComponent(gid)}/presence`);
      sock.current = ws;
      ws.onopen = () => {
        wait = 1000;
        ws.send(JSON.stringify({ type: "hello", token: session ?? undefined, editing }));
      };
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(String(e.data)) as Presence & { type: string };
          if (m.type === "presence") setPresence({ people: m.people, guests: m.guests, editor: m.editor });
        } catch {}
      };
      ws.onclose = (e) => {
        sock.current = null;
        setPresence(null);
        // a map no longer shared is not asked again; anything else (the network, a restart) is, more slowly each time
        if (closed || e.code === 4404 || e.code === 4429) return;
        retry = setTimeout(open, wait);
        wait = Math.min(wait * 2, 15_000);
      };
    };
    open();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      sock.current?.close();
      sock.current = null;
    };
  }, [gid, editing, session]);
  const take = useCallback(() => {
    if (sock.current?.readyState === WebSocket.OPEN) sock.current.send(JSON.stringify({ type: "take" }));
  }, []);
  return { presence, take };
}

type TabMsg = { t: "ask" } | { t: "here"; w: string; claimed: number } | { t: "bye"; w: string } | { t: "saved"; w: string };
const BEAT = 5000;
const GONE = 15_000;

/** The soft lock between this browser's tabs on one private map: the tab that claimed it last edits; the others are
 * told, follow its saves, and may take it. A tab that stops beating (closed without a word) is let go. */
export function useTabLock(mapId: string | null): { editor: "you" | "elsewhere" | null; take: () => void; saved: () => void; onSaved: (fn: () => void) => () => void } {
  const [editor, setEditor] = useState<"you" | "elsewhere" | null>(null);
  // this tab's name among the others, made when the tab first speaks
  const me = useRef("");
  const claimed = useRef(0);
  const others = useRef(new Map<string, { claimed: number; at: number }>());
  const chan = useRef<BroadcastChannel | null>(null);
  const listeners = useRef(new Set<() => void>());
  const decide = useCallback(() => {
    const now = Date.now();
    for (const [w, x] of others.current) if (now - x.at > GONE) others.current.delete(w);
    const top = [...others.current.entries()].reduce<[string, number] | null>((a, [w, x]) => (x.claimed > 0 && (!a || x.claimed > a[1] || (x.claimed === a[1] && w > a[0])) ? [w, x.claimed] : a), null);
    // nobody claims: this tab does
    if (!top && !claimed.current) claimed.current = now;
    const mine = claimed.current > 0 && (!top || claimed.current > top[1] || (claimed.current === top[1] && me.current > top[0]));
    setEditor(mine ? "you" : "elsewhere");
  }, []);
  useEffect(() => {
    if (!mapId || typeof BroadcastChannel === "undefined") return;
    if (!me.current) me.current = crypto.randomUUID().slice(0, 8);
    const c = new BroadcastChannel(`jadhr-map-${mapId}`);
    chan.current = c;
    const say = (m: TabMsg) => c.postMessage(m);
    c.onmessage = (e: MessageEvent<TabMsg>) => {
      const m = e.data;
      if (m.t === "ask") say({ t: "here", w: me.current, claimed: claimed.current });
      else if (m.t === "here") others.current.set(m.w, { claimed: m.claimed, at: Date.now() });
      else if (m.t === "bye") others.current.delete(m.w);
      else if (m.t === "saved") listeners.current.forEach((fn) => fn());
      if (m.t !== "saved") decide();
    };
    // ask who is here; whoever answers within a moment is counted before this tab claims
    say({ t: "ask" });
    const first = setTimeout(() => {
      decide();
      say({ t: "here", w: me.current, claimed: claimed.current });
    }, 250);
    const beat = setInterval(() => {
      say({ t: "here", w: me.current, claimed: claimed.current });
      decide();
    }, BEAT);
    const bye = () => say({ t: "bye", w: me.current });
    window.addEventListener("pagehide", bye);
    return () => {
      clearTimeout(first);
      clearInterval(beat);
      window.removeEventListener("pagehide", bye);
      bye();
      c.close();
      chan.current = null;
    };
  }, [mapId, decide]);
  const take = useCallback(() => {
    claimed.current = Date.now();
    chan.current?.postMessage({ t: "here", w: me.current, claimed: claimed.current } satisfies TabMsg);
    decide();
  }, [decide]);
  const saved = useCallback(() => chan.current?.postMessage({ t: "saved", w: me.current } satisfies TabMsg), []);
  const onSaved = useCallback((fn: () => void) => {
    listeners.current.add(fn);
    return () => void listeners.current.delete(fn);
  }, []);
  return { editor, take, saved, onSaved };
}
