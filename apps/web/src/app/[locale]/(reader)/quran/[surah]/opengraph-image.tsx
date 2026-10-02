import { getTranslations } from "next-intl/server";
import { api } from "@/lib/api";
import { cnt } from "@/lib/format";
import { OG_COLORS, OG_SIZE, ogCard } from "@/lib/og";
import type { Surah } from "@/lib/types";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "سورة من القرآن الكريم";

export default async function Image({ params }: { params: Promise<{ locale: string; surah: string }> }) {
  const { locale, surah } = await params;
  const ts = await getTranslations({ locale, namespace: "surah" });
  const s = (await api<{ data: Surah[] }>("/surahs")).data.find((x) => x.number === Number(surah));
  if (!s) return ogCard({ locale, title: { text: locale === "ar" ? "القرآن الكريم" : "The Quran", size: 96, bold: true }, lines: [] });
  const place = ts(s.revelation_place === "meccan" ? "meccan" : "medinan");
  return ogCard({
    locale,
    title: { text: locale === "ar" ? `سورة ${s.name_ar}` : `Surah ${s.name_translit}`, size: 104, bold: true },
    lines: [
      ...(locale === "ar" ? [] : [{ text: `سورة ${s.name_ar}`, size: 48, color: OG_COLORS.ROOT }]),
      { text: `${ts("versesCount", cnt(s.verse_count, locale))} · ${place}`, size: 40, color: OG_COLORS.MUTED },
    ],
  });
}
