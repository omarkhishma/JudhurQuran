"use client";

import { useQuery } from "@tanstack/react-query";

export type WorkSurah = {
  work: { id: string; title_ar: string; title_en: string; author_ar: string; author_en: string; version: string; attribution_ar: string; attribution_en: string; source_url: string };
  passages: { from_ayah: number; to_ayah: number; from_surah: number; to_surah: number; text: string; footnotes: string | null }[];
};

export function useWorkSurah(workId: string, surah: number, enabled: boolean) {
  return useQuery({
    queryKey: ["work-surah", workId, surah],
    enabled,
    queryFn: async () => {
      const r = await fetch(`/api/v1/works/${encodeURIComponent(workId)}/surahs/${surah}`);
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as WorkSurah;
    },
  });
}
