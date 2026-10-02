import { getTranslations } from "next-intl/server";
import { api } from "@/lib/api";
import { cnt } from "@/lib/format";
import { OG_COLORS, OG_SIZE, ogCard } from "@/lib/og";
import { SITE } from "@/lib/site";
import type { Meta } from "@/lib/types";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = `${SITE.name.ar} — ${SITE.tagline.ar}`;

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tc = await getTranslations({ locale, namespace: "common" });
  const c = (await api<Meta>("/meta")).dataset.counts;
  return ogCard({
    locale,
    title: { text: SITE.tagline[locale === "ar" ? "ar" : "en"], size: 60, bold: true },
    lines: [
      {
        text: [tc("verses", cnt(c.verses, locale)), tc("words", cnt(c.words, locale)), tc("rootsCount", cnt(c.roots, locale))].join(" · "),
        size: 38,
        color: OG_COLORS.ROOT,
      },
    ],
    footer: locale === "ar" ? "كل كلمة في المصحف تقودك إلى جذرها" : "Every word of the mushaf leads to its root",
  });
}
