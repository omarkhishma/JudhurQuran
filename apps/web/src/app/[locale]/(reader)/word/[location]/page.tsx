import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ReaderPage } from "@/components/reader5/ReaderPage";
import { api } from "@/lib/api";
import { citeVerse, formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";
import type { WordDetail } from "@/lib/types";

export const revalidate = 86400;

function parseLocation(raw: string): string {
  const loc = decodeURIComponent(raw);
  if (!/^\d{1,3}:\d{1,3}:\d{1,3}$/.test(loc)) notFound();
  return loc;
}

// Rendered on first request and then cached until the next release (ISR); none are built ahead.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/word/[location]">): Promise<Metadata> {
  const { locale, location } = await params;
  const loc = parseLocation(location);
  const w = await api<WordDetail>(`/words/${loc}`);
  const cite = citeVerse(w.verse.surah_name_ar, w.surah, w.ayah, locale);
  const title =
    locale === "ar"
      ? `معنى كلمة «${w.text_imlaei}» في ${cite}${w.root ? ` — جذرها ${w.root.spaced}` : ""}`
      : `“${w.text_imlaei}” in ${w.verse.key}${w.root ? ` — root ${w.root.translit}` : ""}`;
  const description =
    locale === "ar"
      ? `كلمة «${w.text_imlaei}» (${w.features.pos.ar}) في ${cite}${w.root ? `، من الجذر (${w.root.spaced}) الذي ورد في القرآن الكريم ${formatNumber(w.root.occurrences, locale)} مرة بصيغ منها: ${w.root.lemmas.slice(0, 5).map((l) => l.ar).join("، ")}` : ""}. معناها في سياق الآية، وتحليلها الصرفي، ومواضعها في القرآن.`
      : `The word “${w.text_imlaei}” (${w.features.pos.en}) in Quran ${w.verse.key}${w.root ? `, from the root ${w.root.translit} which occurs ${w.root.occurrences} times in the Quran` : ""}: meaning in context, morphology and occurrences.`;
  return { title, description, alternates: localized(locale, `/word/${loc}`) };
}

/** A word's permalink: the reader on its sūra with the word open in the panel (P2.2). */
export default async function WordPage({ params }: PageProps<"/[locale]/word/[location]">) {
  const { locale, location } = await params;
  setRequestLocale(locale);
  const loc = parseLocation(location);
  const [s, a] = loc.split(":").map(Number);
  if (s < 1 || s > 114) notFound();
  return (
    <ReaderPage
      locale={locale}
      surah={s}
      initial={{ word: loc }}
      crumbs={[
        [locale === "ar" ? `الآية ${a}` : `Verse ${s}:${a}`, `/quran/${s}/${a}`],
        [loc, `/word/${loc}`],
      ]}
    />
  );
}
