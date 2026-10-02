"use client";

import { useQuery } from "@tanstack/react-query";
import type { GlossaryTerm, SurahRoot, WordPayload } from "./types";

export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`/api/v1${path}`);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return (await r.json()) as T;
}

export function useWord(slug: string | null, at: string | null) {
  return useQuery({
    queryKey: ["word", slug, at],
    queryFn: () => getJSON<WordPayload>(`/words/${encodeURIComponent(slug!)}?limit=12${at ? `&at=${at}` : ""}`),
    enabled: !!slug,
    placeholderData: (prev) => (prev && prev.slug === slug ? prev : undefined),
  });
}

export function useGlossary() {
  return useQuery({ queryKey: ["glossary"], queryFn: () => getJSON<{ terms: GlossaryTerm[] }>("/glossary"), staleTime: Infinity });
}

export function useSurahRoots(surah: number) {
  return useQuery({ queryKey: ["surah-roots", surah], queryFn: () => getJSON<{ data: SurahRoot[] }>(`/surahs/${surah}/roots`) });
}
