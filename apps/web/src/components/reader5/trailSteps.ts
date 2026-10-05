"use client";

import { useQueries } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { getJSON } from "@/lib/reader/api";
import { type TrailStep, usePersonal, useReader } from "@/lib/reader/store";
import type { WordPayload } from "@/lib/reader/types";

export type StepView = { step: TrailStep; label: string; sub: string; root: string | null; color: string };

const COLOR: Record<TrailStep["kind"], string> = { word: "var(--c-word)", verse: "var(--c-sentence)", root: "var(--c-root)" };

/** Labels for trail steps: a word's headword (fetched, cached), a verse's key, a root's letters. */
export function useStepViews(steps: TrailStep[]): StepView[] {
  // a word met twice on the trail is asked for once
  const ids = [...new Set(steps.filter((s) => s.kind === "word").map((s) => s.id))];
  const words = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["word", id, null],
      queryFn: () => getJSON<WordPayload>(`/words/${encodeURIComponent(id)}?limit=12`),
      staleTime: Infinity,
    })),
  });
  return steps.map((s) => {
    if (s.kind === "word") {
      const w = words[ids.indexOf(s.id)]?.data;
      return { step: s, label: w ? w.ar.full : s.id, sub: w?.ar.translit ?? "", root: w?.root?.key ?? null, color: COLOR.word };
    }
    if (s.kind === "verse") return { step: s, label: s.id, sub: "", root: null, color: COLOR.verse };
    return { step: s, label: s.id.split("").join(" "), sub: "", root: s.id, color: COLOR.root };
  });
}

/** Going back to a step truncates the trail there first, so the click is not appended again (RDR-587). */
export function useGoToStep(chapter: number | null) {
  const truncate = usePersonal((s) => s.truncateTrail);
  const openWord = useReader((s) => s.openWord);
  const openVerse = useReader((s) => s.openVerse);
  const setFocusRoot = useReader((s) => s.setFocusRoot);
  const router = useRouter();
  return (index: number, step: TrailStep) => {
    truncate(index);
    if (step.kind === "word") openWord({ slug: step.id, at: null });
    else if (step.kind === "verse") {
      const [s, a] = step.id.split(":");
      if (chapter === Number(s)) openVerse(step.id);
      else router.push(`/quran/${s}/${a}`);
    } else setFocusRoot(step.id);
  };
}
