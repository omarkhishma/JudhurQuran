"use client";

import { useQuery } from "@tanstack/react-query";
import type { WordDetail } from "@/lib/types";
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

/** A word read by its place in the text — the way in for words with no lemma (pronouns, the Quranic initials). */
export function useWordAt(at: string | null) {
  return useQuery({ queryKey: ["location", at], queryFn: () => getJSON<WordDetail>(`/words/${at}`), enabled: !!at, staleTime: Infinity });
}

export function useGlossary() {
  return useQuery({ queryKey: ["glossary"], queryFn: () => getJSON<{ terms: GlossaryTerm[] }>("/glossary"), staleTime: Infinity });
}

export function useSurahRoots(surah: number) {
  return useQuery({ queryKey: ["surah-roots", surah], queryFn: () => getJSON<{ data: SurahRoot[] }>(`/surahs/${surah}/roots`) });
}
