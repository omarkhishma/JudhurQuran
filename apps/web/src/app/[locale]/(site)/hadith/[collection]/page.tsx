import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sources } from "@/components/hadith/Sources";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cnt, formatNumber } from "@/lib/format";
import { type Collection, isCollection, kitabHref, refText, unnumbered } from "@/lib/hadith";
import { localized } from "@/lib/seo";

export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

async function load(slug: string) {
  if (!isCollection(slug)) notFound();
  return api<Collection>(`/texts/${slug}`);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/hadith/[collection]">): Promise<Metadata> {
  const { locale, collection } = await params;
  const c = await load(collection);
  const t = await getTranslations({ locale, namespace: "hadith" });
  const title = locale === "ar" ? c.title_ar : c.title_en;
  return {
    title,
    description: `${title}: ${t("records", cnt(c.passage_count, locale))}, ${t("kitabs", cnt(c.chapters.length, locale))}. ${locale === "ar" ? c.meta_ar : c.meta_en}`,
    alternates: localized(locale, `/hadith/${collection}`),
  };
}

/** A collection (P11.2): its author, its edition's numbering, its kitābs in order with how many hadith each holds
 * and the number it opens at; the sources its text and titles come from. */
export default async function CollectionPage({ params }: PageProps<"/[locale]/hadith/[collection]">) {
  const { locale, collection } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hadith");
  const c = await load(collection);
  const ar = locale === "ar";
  const title = ar ? c.title_ar : c.title_en;
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[ar ? "الرئيسية" : "Home", "/"], [t("homeTitle"), "/hadith"], [title, `/hadith/${c.slug}`]])} />
      <nav className="mb-4 flex flex-wrap gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/hadith" className="hover:text-t1">{t("homeTitle")}</Link>
      </nav>
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="ar-classical text-[34px] leading-snug" lang="ar" dir="rtl">{c.title_ar}</h1>
        {!ar && <p className="text-[17px] text-t2">{c.title_en}</p>}
        <p className="text-[13.5px] text-t2">
          {c.info?.death_ah ? t("author", { author: (ar ? c.author_ar : c.author_en) ?? "", death: formatNumber(c.info.death_ah, locale) }) : ar ? c.author_ar : c.author_en}
        </p>
        <p className="flex flex-wrap gap-2 text-[12.5px]">
          <span className="state-chip">{t("records", cnt(c.passage_count, locale))}</span>
          <span className="state-chip">{t("kitabs", cnt(c.chapters.length, locale))}</span>
        </p>
        <p className="max-w-[72ch] text-[13px] text-t3">{t("numbering", { numbering: (ar ? c.meta_ar : c.meta_en) ?? "" })}</p>
      </header>
      <section aria-labelledby="kitabs-h">
        <h2 id="kitabs-h" className="mb-3 text-[17px] font-semibold">{t("kitabsTitle")}</h2>
        <ol className="grid gap-2 sm:grid-cols-2">
          {c.chapters.map((k) => (
            <li key={k.ordinal}>
              <Link href={kitabHref(c.slug, k.ordinal)} className="card flex h-full items-start gap-3 p-3 hover:border-root">
                <span className="min-w-[2.2em] pt-1 text-center text-[12px] text-t3 tabular-nums">{formatNumber(k.ordinal, locale)}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="ar-classical text-[18px] leading-snug" lang="ar" dir="rtl">{k.title_ar}</span>
                  {!ar && k.title_en && <span className="text-[12.5px] text-t2">{k.title_en}</span>}
                  <span className="text-[12px] text-t3">
                    {t("records", cnt(k.total, locale))}
                    {k.children > 0 && <>{ar ? "، " : ", "}{t("babs", cnt(k.children, locale))}</>}
                    {k.first_ref && !unnumbered(k.first_ref) && <>{ar ? "، " : ", "}{t("opensAt", { ref: refText(k.first_ref, locale) })}</>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <Sources sources={[c.source, c.titles_source]} />
    </div>
  );
}
