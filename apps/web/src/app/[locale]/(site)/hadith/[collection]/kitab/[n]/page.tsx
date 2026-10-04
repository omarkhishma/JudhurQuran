import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Grades } from "@/components/hadith/Grades";
import { Sources } from "@/components/hadith/Sources";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cnt, formatNumber } from "@/lib/format";
import { type ChapterPage, type Collection, hadithHref, isCollection, kitabHref, parts, refText, unnumbered } from "@/lib/hadith";
import { localized } from "@/lib/seo";

// a page of a list is read from ?page (or ?q): rendered for each request, the API answers it from its cache
export const dynamic = "force-dynamic";
const PAGE = 30;


async function load(slug: string, n: string, page: number) {
  const ordinal = Number(n);
  if (!isCollection(slug) || !Number.isInteger(ordinal) || ordinal < 1 || page < 1) notFound();
  const [c, ch] = await Promise.all([
    api<Collection>(`/texts/${slug}`),
    api<ChapterPage>(`/texts/${slug}/chapters/${ordinal}?offset=${(page - 1) * PAGE}&limit=${PAGE}`),
  ]);
  if (page > 1 && !ch.passages.length) notFound();
  return { c, ch };
}

const pageOf = (sp: { [k: string]: string | string[] | undefined }) => Math.max(1, Number(sp.page ?? 1) || 1);

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/hadith/[collection]/kitab/[n]">): Promise<Metadata> {
  const { locale, collection, n } = await params;
  const page = pageOf(await searchParams);
  const { c, ch } = await load(collection, n, page);
  const t = await getTranslations({ locale, namespace: "hadith" });
  const book = locale === "ar" ? c.title_ar : c.title_en;
  return {
    title: `${ch.chapter.title_ar} — ${book}`,
    description: `${book}: ${ch.chapter.title_ar}, ${t("records", cnt(ch.total, locale))}.`,
    alternates: localized(locale, kitabHref(collection, ch.chapter.ordinal, page)),
  };
}

/** A kitāb or a bāb (P11.2): where it sits, its bābs, and its hadith in the book's order, a page at a time — each
 * with its number, its isnād set apart from its matn (a split made by rule, said so), the collector's comment, and
 * the graders' rulings under their names. */
export default async function KitabPage({ params, searchParams }: PageProps<"/[locale]/hadith/[collection]/kitab/[n]">) {
  const { locale, collection, n } = await params;
  setRequestLocale(locale);
  const page = pageOf(await searchParams);
  const t = await getTranslations("hadith");
  const { c, ch } = await load(collection, n, page);
  const ar = locale === "ar";
  const book = ar ? c.title_ar : c.title_en;
  const pages = Math.max(1, Math.ceil(ch.total / PAGE));
  const babTitle = new Map(ch.children.map((b) => [b.ordinal, b.title_ar]));
  // a bāb's title heads the first of its hadith on the page
  const headings = ch.passages.map((p, i) => (p.chapter !== ch.chapter.ordinal && (i === 0 || ch.passages[i - 1].chapter !== p.chapter) ? (babTitle.get(p.chapter) ?? null) : null));
  return (
    <div className="mx-auto max-w-[980px] px-4 py-10">
      <JsonLd
        data={breadcrumbs(locale, [
          [ar ? "الرئيسية" : "Home", "/"],
          [t("homeTitle"), "/hadith"],
          [book, `/hadith/${c.slug}`],
          ...ch.path.map((p) => [p.title_ar, kitabHref(c.slug, p.ordinal)] as [string, string]),
          [ch.chapter.title_ar, kitabHref(c.slug, ch.chapter.ordinal)],
        ])}
      />
      <nav className="mb-4 flex flex-wrap items-center gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/hadith" className="hover:text-t1">{t("homeTitle")}</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/hadith/${c.slug}`} className="hover:text-t1">{book}</Link>
        {ch.path.map((p) => (
          <span key={p.ordinal} className="contents">
            <span aria-hidden="true">›</span>
            <Link href={kitabHref(c.slug, p.ordinal)} className="ar-classical hover:text-t1" lang="ar">{p.title_ar}</Link>
          </span>
        ))}
      </nav>
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="ar-classical text-[30px] leading-snug" lang="ar" dir="rtl">{ch.chapter.title_ar}</h1>
        {!ar && ch.chapter.title_en && <p className="text-[15px] text-t2">{ch.chapter.title_en}</p>}
        <p className="flex flex-wrap gap-2 text-[12.5px]">
          <span className="state-chip">{t("records", cnt(ch.total, locale))}</span>
          {ch.children.length > 0 && <span className="state-chip">{t("babs", cnt(ch.children.length, locale))}</span>}
        </p>
      </header>

      {ch.children.length > 0 && page === 1 && (
        <details className="mb-8 rounded-xl border border-line bg-card px-4 py-3" open={ch.children.length <= 12}>
          <summary className="cursor-pointer text-[14px] font-semibold">{t("babsTitle")}</summary>
          <ol className="mt-3 flex flex-col gap-1.5">
            {ch.children.map((b) => (
              <li key={b.ordinal} className="flex items-baseline gap-2">
                <Link href={kitabHref(c.slug, b.ordinal)} className="ar-classical text-[16px] leading-relaxed hover:text-root" lang="ar" dir="rtl">{b.title_ar}</Link>
                <span className="text-[11.5px] text-t3">{formatNumber(b.total, locale)}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      <ol className="flex flex-col gap-4">
        {ch.passages.map((p, i) => {
          const part = parts(p.ar_full, p.meta.split);
          const heading = headings[i];
          const label = unnumbered(p.ref) ? t("unnumbered", { n: formatNumber(p.meta.sequence, locale) }) : t("hadithN", { ref: refText(p.ref, locale) });
          return (
            <li key={p.ref} className="flex flex-col gap-2">
              {heading && (
                <h2 className="ar-classical mt-4 text-[19px] leading-snug text-root" lang="ar" dir="rtl">
                  <Link href={kitabHref(c.slug, p.chapter)} className="hover:underline">{heading}</Link>
                </h2>
              )}
              <article className="card flex flex-col gap-2 p-4" aria-label={label}>
                <Link href={hadithHref(c.slug, p.ref)} className="self-start text-[12.5px] font-semibold text-ring hover:underline" aria-label={t("openHadith", { ref: refText(p.ref, locale) })}>
                  {label}
                </Link>
                {p.meta.empty ? (
                  <p className="text-[13px] text-t3">{t("emptyRecord")}</p>
                ) : part ? (
                  <div className="hadith-text" dir="rtl" lang="ar">
                    <p className="hp-isnad">{part.isnad}</p>
                    {part.matn && <p className="hp-matn">{part.matn}</p>}
                    {part.comment && <p className="hp-comment">{part.comment}</p>}
                  </div>
                ) : (
                  <p className="hadith-text hp-matn" dir="rtl" lang="ar">{p.ar_full}</p>
                )}
                <Grades grades={p.meta.grades} compact />
              </article>
            </li>
          );
        })}
      </ol>

      <nav className="mt-8 flex flex-wrap items-center gap-2" aria-label={t("pageOf", { page: formatNumber(page, locale), pages: formatNumber(pages, locale) })}>
        {page > 1 && <Link href={kitabHref(c.slug, ch.chapter.ordinal, page - 1)} className="btn">{t("prevPage")}</Link>}
        {pages > 1 && <span className="text-[12.5px] text-t3">{t("pageOf", { page: formatNumber(page, locale), pages: formatNumber(pages, locale) })}</span>}
        {page < pages && <Link href={kitabHref(c.slug, ch.chapter.ordinal, page + 1)} className="btn">{t("nextPage")}</Link>}
        <span className="flex-1" />
        {ch.prev && <Link href={kitabHref(c.slug, ch.prev.ordinal)} className="btn">{t(ch.chapter.level > 1 ? "prevBab" : "prevKitab")}</Link>}
        {ch.next && <Link href={kitabHref(c.slug, ch.next.ordinal)} className="btn">{t(ch.chapter.level > 1 ? "nextBab" : "nextKitab")}</Link>}
      </nav>
      <Sources sources={[c.source, c.titles_source]} />
    </div>
  );
}
