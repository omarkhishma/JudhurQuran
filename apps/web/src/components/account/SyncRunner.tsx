"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AUTH_KEY, useAccount } from "@/lib/account/store";
import { DOCS_EVENT } from "@/lib/graph/persist";
import { STORES_CHANNEL, type StoreMessage, TAB_ID } from "@/lib/store/idbStorage";
import { usePersonal, usePrefs } from "@/lib/reader/store";
import { useAnalyseChoices } from "@/lib/store/analyseChoices";
import { useAudio } from "@/lib/store/audio";
import { useNotebook } from "@/lib/store/notebook";
import { useReview } from "@/lib/store/review";
import { useSaved } from "@/lib/store/saved";
import { WATCHED } from "@/lib/sync/adapters";
import { sendDrafts } from "@/lib/contrib";
import { WIPE_KEY } from "@/lib/localData";
import { freezeStorage } from "@/lib/store/safeStorage";
import { isApplying, queueLookup, runSync, stopSync } from "@/lib/sync/run";

/** Each persisted store by its key, so a write in another tab is read here too (no tab overwrites another's). */
const PERSISTED: Record<string, { persist: { rehydrate: () => unknown } }> = {
  [AUTH_KEY]: useAccount,
  "jadhr-saved": useSaved,
  "jadhr-personal": usePersonal,
  "jadhr-notebook": useNotebook,
  "jadhr-review": useReview,
  "jadhr-prefs": usePrefs,
  "jadhr-audio": useAudio,
  "jadhr-analyse-choices": useAnalyseChoices,
};

const SOON = 3000;
const EVERY = 5 * 60_000;

/**
 * Keeps this device and the account in step while signed in (PLAN P6.2): on sign-in, a few seconds after a change,
 * when the tab comes back, when the network does, and every five minutes. Signed out, it does nothing but keep tabs
 * of this browser in step with one another.
 */
export function SyncRunner() {
  const session = useAccount((s) => s.session);
  const qc = useQueryClient();

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      // this browser's data was deleted in another tab: nothing held here may write it back (F15)
      if (e.key === WIPE_KEY && e.newValue) {
        freezeStorage();
        void stopSync().then(() => window.location.reload());
      } else if (e.key === AUTH_KEY && e.newValue === null) useAccount.setState({ session: null, user: null });
      else void PERSISTED[e.key]?.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    // stores kept in IndexedDB announce their writes on a channel instead
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(STORES_CHANNEL) : null;
    if (channel)
      channel.onmessage = (e: MessageEvent<StoreMessage>) => {
        if (e.data?.from !== TAB_ID) void PERSISTED[e.data?.name]?.persist.rehydrate();
      };
    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let timer: number | undefined;
    const go = async () => {
      window.clearTimeout(timer);
      const touched = await runSync();
      if (touched.has("graphs")) void qc.invalidateQueries({ queryKey: ["my-graphs"] });
      if (touched.has("texts")) {
        void qc.invalidateQueries({ queryKey: ["user-texts"] });
        void qc.invalidateQueries({ queryKey: ["user-text"] });
      }
    };
    const soon = (ms = SOON) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void go(), ms);
    };
    // proposals written while signed out go to the review queue (RVQ-Q02: the writing is never lost to sign-in) —
    // after the first sync, so a draft another device already sent has arrived here as sent
    void go()
      .then(() => sendDrafts())
      .then((r) => {
        if (r.sent) {
          void qc.invalidateQueries({ queryKey: ["my-proposals"] });
          void qc.invalidateQueries({ queryKey: ["queue"] });
        }
      });
    const unsubs = WATCHED.map(({ store, pick }) =>
      store.subscribe((s, prev) => {
        if (isApplying()) return;
        const a = pick(s);
        const b = pick(prev);
        if (a.some((x, i) => x !== b[i])) soon();
      }),
    );
    // a lookup made here (not a reading place synced from elsewhere) is shared when the reader turned that on
    const unLookups = usePersonal.subscribe((s, prev) => {
      if (isApplying() || !s.context || s.context.ts === prev.context?.ts) return;
      queueLookup({ lemma: s.context.word, root: s.context.root, verse: s.context.verse });
    });
    const onDocs = () => soon();
    const onBack = () => {
      if (document.visibilityState === "visible") soon(300);
    };
    // a change still waiting when the tab is hidden goes now, not when the reader comes back
    const onHide = () => {
      if (document.visibilityState === "hidden" && timer !== undefined) void go();
    };
    window.addEventListener(DOCS_EVENT, onDocs);
    window.addEventListener("online", onBack);
    document.addEventListener("visibilitychange", onBack);
    document.addEventListener("visibilitychange", onHide);
    const every = window.setInterval(() => {
      if (document.visibilityState === "visible") void go();
    }, EVERY);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(every);
      unsubs.forEach((u) => u());
      unLookups();
      window.removeEventListener(DOCS_EVENT, onDocs);
      window.removeEventListener("online", onBack);
      document.removeEventListener("visibilitychange", onBack);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [session, qc]);

  return null;
}
