import { notFound } from "next/navigation";
import { AudioBar } from "@/components/audio/AudioBar";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { api } from "@/lib/api";
import type { SurahPayload, Verse } from "@/lib/types";
import { ReaderShell, type ChapterInfo } from "./ReaderShell";
import { ReadingSurface, type InitialSelection } from "./ReadingSurface";
import { SurahText } from "./SurahText";

/**
 * The reader as a page (design 03): one sūra, server-rendered, opened on a verse (`/quran/2/255`) or a
 * word (`/word/2:255:3`) when the route names one. The three routes share it so every permalink lands
 * in the same reader with the same URL behaviour (RDR-566, P2.2).
 */
export async function ReaderPage({
  locale,
  surah,
  initial,
  crumbs = [],
}: {
  locale: string;
  surah: number;
  initial?: { verse?: string; word?: string };
  crumbs?: [string, string][];
}) {
  const [payload, basmala] = await Promise.all([api<SurahPayload>(`/surahs/${surah}`), api<Verse>("/verses/1:1")]);
  const s = payload.surah;
  const chapter: ChapterInfo = {
    text: "quran",
    number: surah,
    nameAr: s.name_ar,
    nameTranslit: s.name_translit,
    place: s.revelation_place as "meccan" | "medinan",
    verseCount: s.verse_count,
    juz: s.juz_start,
  };
  let init: InitialSelection | undefined;
  if (initial?.verse) {
    if (!payload.verses.some((v) => v.key === initial.verse)) notFound();
    init = { verse: initial.verse };
  } else if (initial?.word) {
    const [, a, p] = initial.word.split(":").map(Number);
    const w = payload.verses.find((v) => v.ayah === a)?.words.find((x) => x.position === p);
    if (!w) notFound();
    // particles without a lemma open their verse instead
    init = w.lemma_slug ? { word: { slug: w.lemma_slug, at: initial.word } } : { verse: `${surah}:${a}` };
  }
  const ar = locale === "ar";
  return (
    <>
      <JsonLd
        data={breadcrumbs(locale, [
          [ar ? "الرئيسية" : "Home", "/"],
          [ar ? "القرآن الكريم" : "The Quran", "/quran"],
          [ar ? `سورة ${s.name_ar}` : `Surah ${s.name_translit}`, `/quran/${surah}`],
          ...crumbs,
        ])}
      />
      <ReaderShell chapter={chapter} footer={<AudioBar surah={surah} surahName={s.name_ar} />}>
        <ReadingSurface chapter={chapter} initial={init}>
          <SurahText payload={payload} basmala={basmala} locale={locale} />
        </ReadingSurface>
      </ReaderShell>
    </>
  );
}
