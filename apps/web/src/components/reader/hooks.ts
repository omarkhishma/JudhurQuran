"use client";

import { useQuery } from "@tanstack/react-query";
import type { Commentary, OccurrencesPage, WordDetail } from "@/lib/types";

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`/api/v1${path}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return (await r.json()) as T;
}

export function useWord(location: string | null, initialData?: WordDetail) {
  return useQuery({
    queryKey: ["word", location],
    enabled: !!location,
    queryFn: () => getJson<WordDetail>(`/words/${location}`),
    initialData,
  });
}

export function useCommentary(verseKey: string | null, works: string[], initialData?: Commentary) {
  return useQuery({
    queryKey: ["commentary", verseKey, works.join(",")],
    enabled: !!verseKey && works.length > 0,
    queryFn: () => getJson<Commentary>(`/verses/${verseKey}/commentary?works=${encodeURIComponent(works.join(","))}`),
    initialData,
  });
}

export function useOccurrences(root: string | null, lemmaId: number | null, limit = 6, initialData?: OccurrencesPage) {
  return useQuery({
    queryKey: ["occ", root, lemmaId, limit],
    enabled: !!root,
    initialData,
    queryFn: () =>
      getJson<OccurrencesPage>(
        `/roots/${encodeURIComponent(root!)}/occurrences?limit=${limit}${lemmaId ? `&lemma=${lemmaId}` : ""}`,
      ),
  });
}
