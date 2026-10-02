import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ReaderPage } from "@/components/reader5/ReaderPage";
import { api } from "@/lib/api";
import { citeVerse } from "@/lib/format";
import { localized } from "@/lib/seo";
import type { Commentary, Surah, Verse } from "@/lib/types";

export const revalidate = 86400;

function parse(surah: string, ayah: string): { s: number; a: number } {
  const s = Number(surah);
  const a = Number(ayah);
  if (!Number.isInteger(s) || !Number.isInteger(a) || s < 1 || s > 114 || a < 1) notFound();
  return { s, a };
}

// Rendered on first request and then cached until the next release (ISR); none are built ahead.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/quran/[surah]/[ayah]">): Promise<Metadata> {
  const { locale, surah, ayah } = await params;
  const { s: n, a } = parse(surah, ayah);
  const [verse, { surah: s }] = await Promise.all([api<Verse>(`/verses/${n}:${a}`), api<{ surah: Surah }>(`/surahs/${n}?end=1`)]);
  const cite = citeVerse(s.name_ar, s.number, verse.ayah, locale, s.name_translit);
  const text = verse.tokens.map((t) => t.text).join(" ");
  const tafsir = await api<Commentary>(`/verses/${verse.key}/commentary?works=muyassar`);
  const gist = tafsir.data[0]?.passage?.text.slice(0, 150) ?? "";
  const title = locale === "ar" ? `${cite} — ${verse.text_imlaei.split(" ").slice(0, 8).join(" ")}` : `Quran ${cite}`;
  const description = locale === "ar" ? `﴿${verse.text_imlaei}﴾ — التفسير الميسر: ${gist}…` : `${text.slice(0, 80)} — tafsir, translation, and the root of every word.`;
  return { title, description, alternates: localized(locale, `/quran/${s.number}/${verse.ayah}`) };
}

/** A verse's permalink: the reader on its sūra, the verse open in the panel with its tafsir (P2.2/P2.5a). */
export default async function VersePage({ params }: PageProps<"/[locale]/quran/[surah]/[ayah]">) {
  const { locale, surah, ayah } = await params;
  setRequestLocale(locale);
  const { s, a } = parse(surah, ayah);
  return (
    <ReaderPage
      locale={locale}
      surah={s}
      initial={{ verse: `${s}:${a}` }}
      crumbs={[[locale === "ar" ? `الآية ${a}` : `Verse ${s}:${a}`, `/quran/${s}/${a}`]]}
    />
  );
}
