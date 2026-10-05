import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { OG_COLORS, OG_SIZE, ogCard } from "@/lib/og";
import { quranImage } from "@/lib/ogQuran";
import type { Surah } from "@/lib/types";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "آية من القرآن الكريم مع تفسيرها وجذور كلماتها";

/** A verse's share card (B7): the verse in the mushaf's script, exactly — as long as three lines hold it, the card
 * saying so where it goes on — with its sūra and number. */
export default async function Image({ params }: { params: Promise<{ locale: string; surah: string; ayah: string }> }) {
  const { locale, surah, ayah } = await params;
  if (!/^\d{1,3}$/.test(surah) || !/^\d{1,3}$/.test(ayah)) notFound();
  const [surahs, verse] = await Promise.all([api<{ data: Surah[] }>("/surahs"), api<{ text_qpc: string }>(`/verses/${surah}:${ayah}`).catch(() => null)]);
  const s = surahs.data.find((x) => x.number === Number(surah));
  const ar = locale === "ar";
  const name = s ? (ar ? `سورة ${s.name_ar}` : `Surah ${s.name_translit}`) : ar ? "القرآن الكريم" : "The Quran";
  const quran = verse ? await quranImage(verse.text_qpc, { width: 1000, size: 54, minSize: 34, maxLines: 3, color: OG_COLORS.INK }) : undefined;
  return ogCard({
    locale,
    quran,
    title: { text: ar ? `${name} • الآية ${formatNumber(Number(ayah), locale)}` : `${name} • ${surah}:${ayah}`, size: 40, bold: true, color: OG_COLORS.ROOT },
    lines: quran?.cut ? [{ text: ar ? "تتمة الآية على الموقع" : "The verse continues on the site", size: 28, color: OG_COLORS.MUTED }] : [],
  });
}
