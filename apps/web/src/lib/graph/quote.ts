"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { getJSON } from "@/lib/reader/api";

/** A dictionary's article as the dataset gives it, with its work's credit (GET /lexicon/entries/{id}). */
export type Entry = {
  entry_id: number;
  root_key: string;
  headword: string;
  body: string;
  page_ref: string | null;
  title_ar: string;
  title_en: string;
  author_ar: string;
  author_en: string;
  lang: string;
  attribution_ar: string;
  attribution_en: string;
  redistributable: boolean;
};

export const loadEntry = (id: number) => getJSON<Entry>(`/lexicon/entries/${id}`);

/** The article a quoted note names — the same query the reader's dictionaries use, so an article read there is not
 * fetched again. */
export function useEntry(id: number | undefined) {
  return useQuery({ queryKey: ["lex-entry", id], queryFn: () => loadEntry(id!), enabled: id != null, staleTime: Infinity });
}

/** The works the map's quotations are from, by article id: what names a quoted note in undo labels and for a screen
 * reader. */
export function useEntryTitles(ids: number[], locale: string): Map<number, string> {
  // a stable combine, so the map is made again only when an article arrives
  const combine = useCallback(
    (rs: { data?: Entry }[]) => new Map(rs.flatMap((r, i) => (r.data ? [[ids[i], locale === "ar" ? r.data.title_ar : r.data.title_en] as const] : []))),
    [ids, locale],
  );
  return useQueries({ queries: ids.map((id) => ({ queryKey: ["lex-entry", id], queryFn: () => loadEntry(id), staleTime: Infinity })), combine });
}

/** The first words of an article, cut at a word and marked «…» when cut. */
export function opening(body: string, max: number): { text: string; cut: boolean } {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return { text: flat, cut: false };
  const at = flat.lastIndexOf(" ", max);
  return { text: flat.slice(0, at > max * 0.6 ? at : max), cut: true };
}
