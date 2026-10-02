"use client";

import { useQuery } from "@tanstack/react-query";
import type { Commentary, OccurrencesPage, WordDetail } from "@/lib/types";

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`/api/v1${path}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return (await r.json()) as T;
}

export function useWord(location: string | null) {
  return useQuery({
    queryKey: ["word", location],
    enabled: !!location,
    queryFn: () => getJson<WordDetail>(`/words/${location}`),
  });
}

export function useCommentary(verseKey: string | null, works: string[]) {
  return useQuery({
    queryKey: ["commentary", verseKey, works.join(",")],
    enabled: !!verseKey && works.length > 0,
    queryFn: () => getJson<Commentary>(`/verses/${verseKey}/commentary?works=${encodeURIComponent(works.join(","))}`),
  });
}

export function useOccurrences(root: string | null, lemmaId: number | null, limit = 6) {
  return useQuery({
    queryKey: ["occ", root, lemmaId, limit],
    enabled: !!root,
    queryFn: () =>
      getJson<OccurrencesPage>(
        `/roots/${encodeURIComponent(root!)}/occurrences?limit=${limit}${lemmaId ? `&lemma=${lemmaId}` : ""}`,
      ),
  });
}
