"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { chapterHref, paragraphHref } from "@/lib/books";
import { cnt } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { Fold, VerseLayer } from "./VerseKnowledge";

type Section = { ordinal: number; heading: string; rule: string; passages: number; first: { ref: string; excerpt: string; cite: { key: string; ar: string } | null } | null };
type Book = {
  text: { slug: string; title_ar: string; title_en: string; author_ar: string | null; author_en: string | null };
  sections: Section[];
  total: number;
  source: { license: string | null; license_url: string | null; attribution_ar: string | null; attribution_en: string | null };
};

/**
 * The verse in the tafsir books on the shelf (B55): for each book, the sections its own headings name this verse in —
 * the heading as the book prints it, the opening of the section verbatim with its citation, the way to the whole
 * section — and the books' source and licence. Matched by each book's own rule, never by a guess.
 */
export function VerseCommentary({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["verse-commentary", verseKey], queryFn: () => getJSON<{ data: Book[] }>(`/verses/${verseKey}/books`), staleTime: Infinity });
  if (q.isError || !q.data) return null;
  const books = q.data.data;
  const source = books[0]?.source;
  return (
    <VerseLayer title={t("secCommentary")} meta={books.length ? t("booksN", cnt(books.length, locale)) : undefined} defaultOpen={false}>
      {books.length === 0 ? (
        <p className="text-[12.5px] text-t3">{t("commentaryNone")}</p>
      ) : (
        <>
          {books.map((b) => (
            <article key={b.text.slug} className="kn-item" data-book={b.text.slug}>
              <p className="text-[12px] font-medium text-t1">
                <bdi>{locale === "ar" ? b.text.title_ar : b.text.title_en}</bdi>
                {b.text.author_ar && <span className="font-normal text-t3"> • {locale === "ar" ? b.text.author_ar : b.text.author_en}</span>}
              </p>
              {b.sections.map((s) => (
                <div key={s.ordinal} className="flex flex-col gap-1">
                  {/* as the book prints it; «[2.2-3]» reads left to right */}
                  <p className="ar-classical text-[13.5px] text-t2" lang="ar" dir="auto">{s.heading}</p>
                  {s.first && <Fold text={s.first.excerpt} lines={5} className="ar-classical text-[15px] leading-[2]" />}
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-t3">
                    {s.first?.cite && <span lang="ar" dir="rtl">{s.first.cite.ar}</span>}
                    {s.first && (
                      <Link href={paragraphHref(b.text.slug, s.first.ref)} className="text-word hover:underline">
                        {t("commentaryParagraph")}
                      </Link>
                    )}
                    <Link href={chapterHref(b.text.slug, s.ordinal)} className="text-word hover:underline">
                      {t("commentarySection", cnt(s.passages, locale))}
                    </Link>
                  </p>
                </div>
              ))}
              {b.total > b.sections.length && <p className="text-[11px] text-t3">{t("commentaryMore", cnt(b.total - b.sections.length, locale))}</p>}
            </article>
          ))}
          {source && (
            <p className="text-[11px] leading-relaxed text-t3">
              {locale === "ar" ? source.attribution_ar : source.attribution_en}
              {source.license_url && (
                <>
                  {" • "}
                  <a href={source.license_url} target="_blank" rel="noreferrer license" className="underline-offset-2 hover:text-t1 hover:underline">
                    {source.license}
                  </a>
                </>
              )}
            </p>
          )}
          <p className="text-[11px] text-t3">{t("commentaryHow")}</p>
        </>
      )}
    </VerseLayer>
  );
}
