import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sources } from "@/components/hadith/Sources";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cnt, formatNumber } from "@/lib/format";
import { COLLECTIONS, type Collection } from "@/lib/hadith";
import { localized } from "@/lib/seo";

export const revalidate = 86400;

async function load(): Promise<Collection[]> {
  return Promise.all(COLLECTIONS.map((slug) => api<Collection>(`/texts/${slug}`)));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/hadith">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hadith" });
  return { title: t("homeTitle"), description: t("homeLead"), alternates: localized(locale, "/hadith") };
}

/** The hadith collections (P11.2): the Six Books and the Muwaṭṭaʾ, each with its author, its edition's numbering and
 * its counts; a search over their words; the narrators; the sources they draw on. */
export default async function HadithPage({ params }: PageProps<"/[locale]/hadith">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hadith");
  const shelf = await load();
  const ar = locale === "ar";
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[ar ? "الرئيسية" : "Home", "/"], [t("homeTitle"), "/hadith"]])} />
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold">{t("homeTitle")}</h1>
        <p className="max-w-[72ch] leading-relaxed text-t2">{t("homeLead")}</p>
      </header>
      <form action={ar ? "/search" : "/en/search"} method="get" role="search" className="mb-8 flex max-w-[560px] flex-wrap gap-2">
        <label htmlFor="hadith-q" className="sr-only">{t("searchLabel")}</label>
        <input id="hadith-q" name="q" dir="rtl" lang="ar" required className="field min-w-0 flex-1 text-[16px]" placeholder={t("searchPlaceholder")} />
        <input type="hidden" name="k" value="hadith" />
        <button type="submit" className="btn btn-primary">{t("searchGo")}</button>
      </form>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shelf.map((c) => (
          <li key={c.slug}>
            <Link href={`/hadith/${c.slug}`} className="card flex h-full flex-col gap-1.5 p-4 hover:border-root" data-collection={c.slug}>
              <span className="ar-classical text-[22px] leading-snug" lang="ar" dir="rtl">{c.title_ar}</span>
              {!ar && <span className="text-[13px] text-t2">{c.title_en}</span>}
              <span className="text-[12.5px] text-t3">
                {c.info?.death_ah ? t("author", { author: (ar ? c.author_ar : c.author_en) ?? "", death: formatNumber(c.info.death_ah, locale) }) : ar ? c.author_ar : c.author_en}
              </span>
              <span className="mt-auto pt-2 text-[12.5px] text-t2">
                {t("records", cnt(c.passage_count, locale))}{ar ? "، " : ", "}{t("kitabs", cnt(c.chapters.length, locale))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href="/hadith/narrators" className="btn">{t("narratorsTitle")}</Link>
      </p>
      <Sources sources={[shelf[0]?.source, shelf[0]?.titles_source]} />
    </div>
  );
}
