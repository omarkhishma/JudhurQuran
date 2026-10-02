import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { OG_COLORS, OG_SIZE, ogCard } from "@/lib/og";
import type { Surah } from "@/lib/types";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "آية من القرآن الكريم مع تفسيرها وجذور كلماتها";

export default async function Image({ params }: { params: Promise<{ locale: string; surah: string; ayah: string }> }) {
  const { locale, surah, ayah } = await params;
  const s = (await api<{ data: Surah[] }>("/surahs")).data.find((x) => x.number === Number(surah));
  const ar = locale === "ar";
  const name = s ? (ar ? `سورة ${s.name_ar}` : `Surah ${s.name_translit}`) : ar ? "القرآن الكريم" : "The Quran";
  return ogCard({
    locale,
    title: { text: name, size: 96, bold: true },
    lines: [
      { text: ar ? `الآية ${formatNumber(Number(ayah), locale)}` : `Verse ${surah}:${ayah}`, size: 64, bold: true, color: OG_COLORS.ROOT },
      { text: ar ? "مع التفسير وجذر كل كلمة" : "With tafsir and the root of every word", size: 36, color: OG_COLORS.MUTED },
    ],
  });
}
