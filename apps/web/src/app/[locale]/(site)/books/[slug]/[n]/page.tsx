import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookText } from "@/components/books/BookText";
import { chapterLabel } from "@/components/books/chapterLabel";
import { RecordPlace } from "@/components/library/RecordPlace";
import { Sources } from "@/components/hadith/Sources";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { type Book, type BookChapter, chapterHref, citedBy, isBookSlug } from "@/lib/books";
import { cnt, formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";
import type { Surah } from "@/lib/types";

// a page of a section is read from ?page: rendered for each request, the API answers it from its cache
export const dynamic = "force-dynamic";
const PAGE = 40;

async function load(slug: string, n: string, page: number) {
  const ordinal = Number(n);
  if (!isBookSlug(slug) || !Number.isInteger(ordinal) || ordinal < 1 || page < 1) notFound();
  const [b, ch, surahs] = await Promise.all([
    api<Book>(`/texts/${slug}`),
    api<BookChapter>(`/texts/${slug}/chapters/${ordinal}?offset=${(page - 1) * PAGE}&limit=${PAGE}&words=true`),
    api<{ data: Surah[] }>("/surahs"),
  ]);
  if (b.kind !== "book" || (page > 1 && !ch.passages.length)) notFound();
  return { b, ch, surahs: Object.fromEntries(surahs.data.map((s) => [s.number, s.name_ar])) as { [n: number]: string } };
}

const pageOf = (sp: { [k: string]: string | string[] | undefined }) => Math.max(1, Number(sp.page ?? 1) || 1);

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/books/[slug]/[n]">): Promise<Metadata> {
  const { locale, slug, n } = await params;
  const page = pageOf(await searchParams);
  const { b, ch } = await load(slug, n, page);
  const t = await getTranslations({ locale, namespace: "books" });
  const name = chapterLabel({ title_ar: ch.chapter.title_ar, meta: ch.chapter.meta }, t, locale, b.info.volumes ?? 1);
  return {
    title: `${name} — ${b.title_ar}`,
    description: `${b.title_ar}، ${b.author_ar}: ${name}، ${t("paragraphs", cnt(ch.total, locale))}.`,
    alternates: localized(locale, chapterHref(slug, ch.chapter.ordinal, page)),
  };
}

/** A section of a book (P11.3): where it sits, what lies under it, and its paragraphs in the book's order a page at a
 * time — every word open to its reading, the printed page each opens on where the version's pages are cited, the
 * editor's brackets marked, the verses he referred to as links, each paragraph's citation. */
export default async function BookChapterPage({ params, searchParams }: PageProps<"/[locale]/books/[slug]/[n]">) {
  const { locale, slug, n } = await params;
  setRequestLocale(locale);
  const page = pageOf(await searchParams);
  const t = await getTranslations("books");
  const { b, ch, surahs } = await load(slug, n, page);
  const ar = locale === "ar";
  const volumes = b.info.volumes ?? 1;
  const name = chapterLabel({ title_ar: ch.chapter.title_ar, meta: ch.chapter.meta }, t, locale, volumes);
  const pages = Math.max(1, Math.ceil(ch.total / PAGE));
  const sub = new Map(ch.children.map((c) => [c.ordinal, c]));
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10">
      <JsonLd
        data={breadcrumbs(locale, [
          [ar ? "الرئيسية" : "Home", "/"],
          [t("homeTitle"), "/books"],
          [b.title_ar, `/books/${slug}`],
          ...ch.path.map((p) => [p.title_ar, chapterHref(slug, p.ordinal)] as [string, string]),
          [name, chapterHref(slug, ch.chapter.ordinal)],
        ])}
      />
      <nav className="mb-4 flex flex-wrap items-center gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/books" className="hover:text-t1">{t("homeTitle")}</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/books/${slug}`} className="ar-classical hover:text-t1" lang="ar">{b.title_ar}</Link>
        {ch.path.map((p) => (
          <span key={p.ordinal} className="contents">
            <span aria-hidden="true">›</span>
            <Link href={chapterHref(slug, p.ordinal)} className="ar-classical hover:text-t1" lang="ar">{p.title_ar}</Link>
          </span>
        ))}
      </nav>
      <header className="mb-6 flex flex-col gap-2">
        <h1 className={ch.chapter.title_ar ? "ar-classical text-[28px] leading-snug" : "text-[24px] font-semibold"} lang={ch.chapter.title_ar ? "ar" : locale} dir={ch.chapter.title_ar ? "rtl" : undefined}>
          {name}
        </h1>
        <p className="flex flex-wrap gap-2 text-[12.5px]">
          <span className="state-chip">{t("paragraphs", cnt(ch.total, locale))}</span>
          {ch.children.length > 0 && <span className="state-chip">{t("sections", cnt(ch.children.length, locale))}</span>}
          <span className="state-chip">{t(citedBy(b.info).label)}</span>
        </p>
      </header>

      {ch.children.length > 0 && page === 1 && (
        <details className="mb-8 rounded-xl border border-line bg-card px-4 py-3" open={ch.children.length <= 12}>
          <summary className="cursor-pointer text-[14px] font-semibold">{t("subsections")}</summary>
          <ol className="mt-3 flex flex-col gap-1.5">
            {ch.children.map((c) => (
              <li key={c.ordinal} className="flex items-baseline gap-2">
                <Link href={chapterHref(slug, c.ordinal)} className="ar-classical text-[16px] leading-relaxed hover:text-root" lang="ar" dir="rtl">
                  {chapterLabel(c, t, locale, volumes)}
                </Link>
                <span className="text-[11.5px] text-t3">{formatNumber(c.total, locale)}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      <BookText
        slug={slug}
        paragraphs={ch.passages.map((p, i) => ({
          ...p,
          // a sub-section's heading over the first of its paragraphs on the page
          heading: p.chapter !== ch.chapter.ordinal && (i === 0 || ch.passages[i - 1].chapter !== p.chapter) ? (sub.get(p.chapter)?.title_ar ?? null) : null,
          headingHref: chapterHref(slug, p.chapter),
        }))}
        forms={ch.forms}
        surahs={surahs}
        volumes={volumes}
      />

      <nav className="mt-8 flex flex-wrap items-center gap-2" aria-label={t("pageOf", { page: formatNumber(page, locale), pages: formatNumber(pages, locale) })}>
        {page > 1 && <Link href={chapterHref(slug, ch.chapter.ordinal, page - 1)} className="btn">{t("prevPage")}</Link>}
        {pages > 1 && <span className="text-[12.5px] text-t3">{t("pageOf", { page: formatNumber(page, locale), pages: formatNumber(pages, locale) })}</span>}
        {page < pages && <Link href={chapterHref(slug, ch.chapter.ordinal, page + 1)} className="btn">{t("nextPage")}</Link>}
        <span className="flex-1" />
        {ch.prev && <Link href={chapterHref(slug, ch.prev.ordinal)} className="btn">{t("prevChapter")}</Link>}
        {ch.next && <Link href={chapterHref(slug, ch.next.ordinal)} className="btn">{t("nextChapter")}</Link>}
      </nav>
      <Sources sources={[b.source]} />
      {ch.passages[0] && <RecordPlace text={`book:${slug}`} chapter={ch.chapter.ordinal} at={ch.passages[0].ref} label={name} />}
    </div>
  );
}
