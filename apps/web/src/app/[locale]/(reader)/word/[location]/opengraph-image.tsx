import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { OG_COLORS, OG_SIZE, ogCard } from "@/lib/og";
import { quranImage } from "@/lib/ogQuran";
import type { WordDetail } from "@/lib/types";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "كلمة من القرآن الكريم: معناها وجذرها ومواضعها";

export default async function Image({ params }: { params: Promise<{ locale: string; location: string }> }) {
  const { locale, location } = await params;
  // a word's place and nothing else goes into the API's address, as the page checks it (security review I4)
  const loc = decodeURIComponent(location);
  if (!/^\d{1,3}:\d{1,3}:\d{1,3}$/.test(loc)) notFound();
  const w = await api<WordDetail>(`/words/${loc}`);
  const ar = locale === "ar";
  const where = ar
    ? `سورة ${w.verse.surah_name_ar} • الآية ${formatNumber(w.ayah, locale)}`
    : `Quran ${w.verse.key}`;
  const root = w.root ? w.root.spaced : null;
  // the word as the mushaf writes it, with its marks (B7)
  const quran = await quranImage(w.text_uthmani, { width: 900, size: 100, minSize: 60, maxLines: 1, color: OG_COLORS.INK, lineHeight: 1.6 });
  return ogCard({
    locale,
    quran,
    title: { text: where, size: 34, color: OG_COLORS.MUTED },
    lines: [
      ...(!ar && w.gloss_en ? [{ text: `“${w.gloss_en}”`, size: 40 }] : []),
      root
        ? { text: ar ? `الجذر: ${root}` : root, size: 52, color: OG_COLORS.ROOT, bold: true }
        : { text: ar ? (w.features.pos?.ar ?? "") : (w.features.pos?.en ?? ""), size: 40, color: OG_COLORS.MUTED },
    ],
  });
}
