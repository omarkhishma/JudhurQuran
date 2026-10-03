import { getTranslations } from "next-intl/server";
import { api } from "@/lib/api";
import { cnt } from "@/lib/format";
import { OG_COLORS, OG_SIZE, ogCard } from "@/lib/og";
import type { RootDetail } from "@/lib/types";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "جذر قرآني وعائلته ومواضعه";

export default async function Image({ params }: { params: Promise<{ locale: string; root: string }> }) {
  const { locale, root } = await params;
  const tc = await getTranslations({ locale, namespace: "common" });
  const r = await api<RootDetail>(`/roots/${encodeURIComponent(decodeURIComponent(root))}`);
  const ar = locale === "ar";
  const occ = tc("occurrences", cnt(r.occurrences, locale));
  const verses = tc("verses", cnt(r.verse_count, locale));
  const surahs = tc("surahs", cnt(r.surah_count, locale));
  return ogCard({
    locale,
    title: { text: r.spaced, size: 150, bold: true, color: OG_COLORS.ROOT },
    lines: [
      { text: ar ? `${occ} في ${verses} من ${surahs}` : `${occ} in ${verses} of ${surahs}`, size: 40 },
      { text: ar ? tc("lemmas", cnt(r.lemma_count, locale)) : `${tc("lemmas", cnt(r.lemma_count, locale))} • ${r.translit}`, size: 34, color: OG_COLORS.MUTED },
    ],
  });
}
