"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useIsClient } from "@/lib/client";
import { usePersonal, usePrefs } from "@/lib/reader/store";
import { dueOrder, useReview } from "@/lib/store/review";
import { useSaved } from "@/lib/store/saved";

export type RootRef = { key: string; spaced: string };

/**
 * The roots of the reader's starred and known words (RDR-345, 360: starred, or learning then confirmed), as
 * {key, spaced}. The words go in a POST body; the answer is cached for the session only.
 */
export function useMyRoots(enabled = true) {
  const client = useIsClient();
  const bookmarks = useSaved((s) => s.bookmarks);
  const states = usePersonal((s) => s.wordStates);
  const slugs = useMemo(() => [...new Set([...bookmarks.filter((b) => b.kind === "lemma").map((b) => b.key), ...Object.keys(states).filter((k) => states[k] === "known")])].sort(), [bookmarks, states]);
  return useQuery({
    queryKey: ["my-roots", slugs.join(",")],
    queryFn: async () => {
      const r = await fetch("/api/v1/lemmas/roots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs }) });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { data: { root: RootRef | null }[] };
      const seen = new Map<string, RootRef>();
      for (const x of d.data) if (x.root && !seen.has(x.root.key)) seen.set(x.root.key, { key: x.root.key, spaced: x.root.spaced });
      return [...seen.values()];
    },
    enabled: enabled && client && slugs.length > 0,
    staleTime: Infinity,
  });
}

/** The time, moving on every minute: what is due changes as the clock does, not only when something is graded. */
function useNow(step = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), step);
    return () => clearInterval(id);
  }, [step]);
  return now;
}

/** How many of the reader's roots are due now: the header's badge (RDR-346, from the scheduler). */
export function useDueCount(): number | null {
  const mine = useMyRoots();
  return useDueOf(mine.data);
}

/** The quiet count beside the reader's other places (plan B30): nothing at all when the reader turned it off. */
export function useDueSignal(): number | null {
  const on = usePrefs((s) => s.dueSignal);
  const mine = useMyRoots(on);
  const n = useDueOf(on ? mine.data : undefined);
  return on ? n : null;
}

function useDueOf(mine: RootRef[] | undefined): number | null {
  const cards = useReview((s) => s.cards);
  const now = useNow();
  if (!mine?.length) return null;
  return dueOrder(mine.map((r) => r.key), cards, now).length;
}

