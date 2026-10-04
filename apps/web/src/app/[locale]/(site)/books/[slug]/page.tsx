import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { chapterLabel } from "@/components/books/chapterLabel";
import { Sources } from "@/components/hadith/Sources";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { type Book, chapterHref, citedBy, isBookSlug } from "@/lib/books";
import { cnt, formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";

export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

async function load(slug: string) {
  if (!isBookSlug(slug)) notFound();
  const b = await api<Book>(`/texts/${slug}`);
  if (b.kind !== "book") notFound();
  return b;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/books/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const b = await load(slug);
  const t = await getTranslations({ locale, namespace: "books" });
  return {
    title: `${b.title_ar} — ${b.author_ar}`,
    description: `${b.title_ar}، ${b.author_ar}: ${t("words", cnt(b.token_count, locale))}. ${b.meta_ar ?? ""}`,
    alternates: localized(locale, `/books/${slug}`),
  };
}

/** A book (P11.3): its author and edition as its version's header gives them, how its paragraphs are cited and why,
 * and its contents — the top-level sections with how many paragraphs each holds and what lies under them. */
export default async function BookPage({ params }: PageProps<"/[locale]/books/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("books");
  const b = await load(slug);
  const ar = locale === "ar";
  const i = b.info;
  const volumes = i.volumes ?? 1;
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[ar ? "الرئيسية" : "Home", "/"], [t("homeTitle"), "/books"], [b.title_ar, `/books/${slug}`]])} />
      <nav className="mb-4 flex flex-wrap gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/books" className="hover:text-t1">{t("homeTitle")}</Link>
      </nav>
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="ar-classical text-[32px] leading-snug" lang="ar" dir="rtl">{b.title_ar}</h1>
        {!ar && <p className="text-[16px] text-t2">{b.title_en}</p>}
        <p className="text-[14px] text-t2">
          <bdi lang="ar">{b.author_ar}</bdi> {ar ? `(ت ${formatNumber(i.death_ah, locale)}هـ)` : `(d. ${i.death_ah} AH)`}
        </p>
        {i.author_full_ar && i.author_full_ar !== b.author_ar && (
          <p className="text-[13px] text-t3">{t("authorFull", { name: i.author_full_ar })}</p>
        )}
        <p className="max-w-[80ch] text-[13px] text-t3">{b.meta_ar ? t("edition", { edition: b.meta_ar }) : t("noEdition")}</p>
        <p className="flex flex-wrap gap-2 text-[12.5px]">
          {i.genre && <span className="state-chip">{t(`genre_${i.genre}` as "genre_tafsir")}</span>}
          <span className="state-chip">{t("words", cnt(b.token_count, locale))}</span>
          <span className="state-chip">{t("paragraphs", cnt(b.passage_count, locale))}</span>
          <span className="state-chip" title={t(citedBy(i).note)}>
            {t(citedBy(i).label)}
          </span>
        </p>
        <p className="max-w-[80ch] text-[12.5px] leading-relaxed text-t3">
          {t(citedBy(i).note)}
          {!i.pages_trusted && i.pages_why.length > 0 && (
            <> {t("pagesWhy", { why: i.pages_why.map((w) => t(`why_${w.why}`, { n: formatNumber(w.n ?? 0, locale), of: formatNumber(w.of ?? 0, locale) })).join(ar ? "؛ " : "; ") })}</>
          )}
        </p>
        <p className="text-[12px] text-t3">
          {t("versionLabel")} <bdi dir="ltr" className="font-mono text-[11.5px]">{i.version}</bdi>
        </p>
      </header>

      <section aria-labelledby="contents-h">
        <h2 id="contents-h" className="mb-3 text-[18px] font-semibold">
          {t("contents")} <span className="text-[13px] font-normal text-t3">{t("sections", cnt(b.chapters.length, locale))}</span>
        </h2>
        <ol className="flex flex-col divide-y divide-line rounded-xl border border-line bg-card">
          {b.chapters.map((c) => (
            <li key={c.ordinal} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
              <Link href={chapterHref(slug, c.ordinal)} className={`${c.title_ar ? "ar-classical text-[17px]" : "text-[14px]"} min-w-0 flex-1 leading-relaxed hover:text-root`} lang={c.title_ar ? "ar" : locale} dir={c.title_ar ? "rtl" : undefined}>
                {chapterLabel(c, t, locale, volumes)}
              </Link>
              <span className="text-[12px] text-t3">
                {t("paragraphs", cnt(c.total, locale))}
                {c.children > 0 && <>{ar ? "، " : ", "}{t("sections", cnt(c.children, locale))}</>}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <Sources sources={[b.source]} />
    </div>
  );
}
