import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookText } from "@/components/books/BookText";
import { Sources } from "@/components/hadith/Sources";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { type Book, type BookParagraph, chapterHref, citedBy, isBookSlug, paragraphHref } from "@/lib/books";
import { localized } from "@/lib/seo";
import type { Surah } from "@/lib/types";

export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

async function load(slug: string, raw: string) {
  const ref = decodeURIComponent(raw);
  if (!isBookSlug(slug) || !/^\d{1,6}$/.test(ref)) notFound();
  const [b, p, surahs] = await Promise.all([
    api<Book>(`/texts/${slug}`),
    api<BookParagraph>(`/texts/${slug}/passages/${ref}`),
    api<{ data: Surah[] }>("/surahs"),
  ]);
  if (b.kind !== "book") notFound();
  return { b, p, surahs: Object.fromEntries(surahs.data.map((s) => [s.number, s.name_ar])) as { [n: number]: string } };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/books/[slug]/p/[ref]">): Promise<Metadata> {
  const { locale, slug, ref } = await params;
  const { b, p } = await load(slug, ref);
  const t = await getTranslations({ locale, namespace: "books" });
  return {
    title: t("paragraphTitle", { book: b.title_ar, cite: p.cite.ar.split("، ").slice(-2).join("، ") }),
    description: p.ar_full.replace(/ /g, " ").slice(0, 160),
    alternates: localized(locale, paragraphHref(slug, p.ref)),
  };
}

/** A book's paragraph (P11.3) — the address its citation names: the paragraph with every word open to its reading,
 * its citation in Arabic and its stable key, its place in the book, the paragraphs before and after it. */
export default async function BookParagraphPage({ params }: PageProps<"/[locale]/books/[slug]/p/[ref]">) {
  const { locale, slug, ref } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("books");
  const { b, p, surahs } = await load(slug, ref);
  const ar = locale === "ar";
  const where = p.path[p.path.length - 1];
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10">
      <JsonLd
        data={breadcrumbs(locale, [
          [ar ? "الرئيسية" : "Home", "/"],
          [t("homeTitle"), "/books"],
          [b.title_ar, `/books/${slug}`],
          ...p.path.filter((x) => x.title_ar).map((x) => [x.title_ar, chapterHref(slug, x.ordinal)] as [string, string]),
          [p.cite.ar, paragraphHref(slug, p.ref)],
        ])}
      />
      <nav className="mb-4 flex flex-wrap items-center gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/books" className="hover:text-t1">{t("homeTitle")}</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/books/${slug}`} className="ar-classical hover:text-t1" lang="ar">{b.title_ar}</Link>
        {p.path
          .filter((x) => x.title_ar)
          .map((x) => (
            <span key={x.ordinal} className="contents">
              <span aria-hidden="true">›</span>
              <Link href={chapterHref(slug, x.ordinal)} className="ar-classical hover:text-t1" lang="ar">{x.title_ar}</Link>
            </span>
          ))}
      </nav>
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="ar-classical text-[24px] leading-snug" lang="ar" dir="rtl">{p.cite.ar}</h1>
        <p className="text-[12px] text-t3">
          {t("citeKey")}: <code dir="ltr" className="break-all">{p.cite.key}</code>
        </p>
        <p className="text-[12.5px] text-t3">{t(citedBy(b.info).note)}</p>
      </header>
      <BookText slug={slug} paragraphs={[{ ref: p.ref, meta: p.meta, cite: p.cite, segments: p.segments, words: p.words }]} forms={p.forms} surahs={surahs} volumes={b.info.volumes ?? 1} linkParagraphs={false} />
      <nav className="mt-8 flex flex-wrap gap-2" aria-label={p.cite.ar}>
        {p.prev && <Link href={paragraphHref(slug, p.prev)} className="btn" rel="prev">{t("prevParagraph")}</Link>}
        {p.next && <Link href={paragraphHref(slug, p.next)} className="btn" rel="next">{t("nextParagraph")}</Link>}
        {where && <Link href={chapterHref(slug, where.ordinal)} className="btn">{t("openChapter")}</Link>}
      </nav>
      <Sources sources={[p.source]} />
    </div>
  );
}
