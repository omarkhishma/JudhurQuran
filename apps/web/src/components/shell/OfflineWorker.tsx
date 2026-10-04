"use client";

import { useEffect, useRef } from "react";
import { keep, keptFor, WORKER } from "@/lib/offline";
import { useSaved } from "@/lib/store/saved";

/**
 * Registers the offline worker in the production build (PLAN P12) — never inside a published map's frame, which
 * belongs to another site — and keeps the reader's saved items for offline reading: all of them once a visit, each
 * new one as it is saved.
 */
export function OfflineWorker() {
  const bookmarks = useSaved((s) => s.bookmarks);
  const sent = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    if (/^\/(en\/)?embed\//.test(location.pathname)) return;
    navigator.serviceWorker.register(WORKER, { scope: "/" }).catch(() => {});
  }, []);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const fresh = bookmarks.filter((b) => !sent.current.has(`${b.kind}:${b.key}`));
    if (!fresh.length) return;
    const send = async () => {
      for (const b of fresh) sent.current.add(`${b.kind}:${b.key}`);
      const items = await Promise.all(fresh.slice(0, 50).map(keptFor));
      keep({ pages: items.flatMap((x) => x.pages), data: items.flatMap((x) => x.data) });
    };
    if (navigator.serviceWorker.controller) void send();
    else navigator.serviceWorker.ready.then(() => setTimeout(() => void send(), 500)).catch(() => {});
  }, [bookmarks]);
  return null;
}
