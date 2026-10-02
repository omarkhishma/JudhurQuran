import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import type { Commentary, OccurrencesPage, WordDetail } from "@/lib/types";
import { WordPanel } from "@/components/reader/WordPanel";
import { citeVerse, formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";

export const revalidate = 86400;

function parseLocation(raw: string): string {
  const loc = decodeURIComponent(raw);
  if (!/^\d{1,3}:\d{1,3}:\d{1,3}$/.test(loc)) notFound();
  return loc;
}

async function loadWord(loc: string) {
  return api<WordDetail>(`/words/${loc}`);
}

// Rendered on first request and then cached until the next release (ISR); none are built ahead.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/word/[location]">): Promise<Metadata> {
  const { locale, location } = await params;
  const loc = parseLocation(location);
  const w = await loadWord(loc);
  const cite = citeVerse(w.verse.surah_name_ar, w.surah, w.ayah, locale);
  const title =
    locale === "ar"
      ? `معنى كلمة «${w.text_imlaei}» في ${cite}${w.root ? ` — جذرها ${w.root.spaced}` : ""}`
      : `“${w.text_imlaei}” in ${w.verse.key}${w.root ? ` — root ${w.root.translit}` : ""}`;
  const description =
    locale === "ar"
      ? `كلمة «${w.text_imlaei}» (${w.features.pos.ar}) في ${cite}${w.root ? `، من الجذر (${w.root.spaced}) الذي ورد في القرآن الكريم ${formatNumber(w.root.occurrences, locale)} مرة بصيغ منها: ${w.root.lemmas.slice(0, 5).map((l) => l.ar).join("، ")}` : ""}. معناها في سياق الآية، وتحليلها الصرفي، ومواضعها في القرآن.`
      : `The word “${w.text_imlaei}” (${w.features.pos.en}) in Quran ${w.verse.key}${w.root ? `, from the root ${w.root.translit} which occurs ${w.root.occurrences} times in the Quran` : ""}: meaning in context, morphology and occurrences.`;
  const path = `/word/${loc}`;
  return { title, description, alternates: localized(locale, path) };
}

export default async function WordPage({ params }: PageProps<"/[locale]/word/[location]">) {
  const { locale, location } = await params;
  setRequestLocale(locale);
  const loc = parseLocation(location);
  const t = await getTranslations("reader");
  const w = await loadWord(loc);
  const [commentary, occurrences] = await Promise.all([
    api<Commentary>(`/verses/${w.verse.key}/commentary?works=muyassar`),
    w.root
      ? api<OccurrencesPage>(`/roots/${encodeURIComponent(w.root.key)}/occurrences?limit=6${w.lemma ? `&lemma=${w.lemma.id}` : ""}`)
      : Promise.resolve(undefined),
  ]);
  const tokens = w.verse.tokens;
  return (
    <div className="mx-auto max-w-[780px] px-4 py-8">
      <JsonLd
        data={breadcrumbs(locale, [
          [(locale === "ar" ? "الرئيسية" : "Home"), "/"],
          [(locale === "ar" ? "القرآن الكريم" : "The Quran"), "/quran"],
          [locale === "ar" ? `سورة ${w.verse.surah_name_ar}` : `Surah ${w.verse.surah_name_translit}`, `/quran/${w.surah}`],
          [locale === "ar" ? `الآية ${w.ayah}` : `Verse ${w.verse.key}`, `/quran/${w.surah}/${w.ayah}`],
          [w.text_imlaei, `/word/${w.location}`],
        ])}
      />
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href={`/quran/${w.surah}`} className="hover:text-t1">
          {locale === "ar" ? `سورة ${w.verse.surah_name_ar}` : `Surah ${w.verse.surah_name_translit}`}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/quran/${w.surah}/${w.ayah}`} className="hover:text-t1">
          {citeVerse(w.verse.surah_name_ar, w.surah, w.ayah, locale, w.verse.surah_name_translit)}
        </Link>
      </nav>
      <figure className="card mb-6 p-5">
        <blockquote className="quran text-[26px] leading-[2.2]" dir="rtl" lang="ar">
          {tokens.map((tk, i) => {
            const mine = tk.word_from <= w.position && w.position <= tk.word_to;
            return (
              <span key={tk.position}>
                {mine ? <mark className="rounded-md bg-word-wash px-0.5 text-t1 ring-1 ring-ring/40">{tk.text}</mark> : tk.text}
                {i < tokens.length - 1 ? " " : ""}
              </span>
            );
          })}
        </blockquote>
        <figcaption className="mt-3 flex flex-wrap gap-2">
          <Link href={`/quran/${w.surah}?w=${loc}#v${w.ayah}`} className="btn">{t("readInSurah")}</Link>
          <Link href={`/quran/${w.surah}/${w.ayah}`} className="btn">{t("studyVerse")}</Link>
        </figcaption>
      </figure>
      <article className="card overflow-hidden p-0">
        <WordPanel location={loc} page initial={{ word: w, commentary, occurrences }} />
      </article>
    </div>
  );
}
