import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { bare, OG_COLORS, OG_SIZE, ogCard } from "@/lib/og";
import type { WordDetail } from "@/lib/types";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "كلمة من القرآن الكريم: معناها وجذرها ومواضعها";

export default async function Image({ params }: { params: Promise<{ locale: string; location: string }> }) {
  const { locale, location } = await params;
  const w = await api<WordDetail>(`/words/${decodeURIComponent(location)}`);
  const ar = locale === "ar";
  const where = ar
    ? `سورة ${w.verse.surah_name_ar} · الآية ${formatNumber(w.ayah, locale)}`
    : `Quran ${w.verse.key}`;
  const root = w.root ? w.root.spaced : null;
  return ogCard({
    locale,
    title: { text: bare(w.text_imlaei), size: 128, bold: true },
    lines: [
      ...(!ar && w.gloss_en ? [{ text: `“${w.gloss_en}”`, size: 40 }] : []),
      root
        ? { text: ar ? `الجذر: ${root}` : root, size: 52, color: OG_COLORS.ROOT, bold: true }
        : { text: ar ? (w.features.pos?.ar ?? "") : (w.features.pos?.en ?? ""), size: 40, color: OG_COLORS.MUTED },
      { text: where, size: 34, color: OG_COLORS.MUTED },
    ],
  });
}
