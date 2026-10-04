"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { type Book, bookHref, citedBy } from "@/lib/books";
import { cnt, formatNumber } from "@/lib/format";

export type ShelfBook = Pick<Book, "slug" | "title_ar" | "title_en" | "author_ar" | "author_en" | "token_count" | "passage_count" | "info">;

/** The books on the shelf in the order their authors died, filtered by the subject OpenITI gives them (none where it
 * gives none: no subject of ours). */
export function BookShelf({ books }: { books: ShelfBook[] }) {
  const t = useTranslations("books");
  const locale = useLocale();
  const ar = locale === "ar";
  const genres = [...new Set(books.map((b) => b.info.genre ?? ""))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const [genre, setGenre] = useState<string | null>(null);
  const shown = genre === null ? books : books.filter((b) => (b.info.genre ?? "") === genre);
  const label = (g: string) => (g ? t(`genre_${g}` as "genre_tafsir") : t("filterNone"));
  return (
    <>
      <div role="group" aria-label={t("filterLabel")} className="mb-5 flex flex-wrap gap-2">
        <button type="button" className={`chip${genre === null ? " is-on" : ""}`} aria-pressed={genre === null} onClick={() => setGenre(null)}>
          {t("filterAll")} <span className="text-t3">{formatNumber(books.length, locale)}</span>
        </button>
        {genres.map((g) => (
          <button key={g || "none"} type="button" className={`chip${genre === g ? " is-on" : ""}`} aria-pressed={genre === g} onClick={() => setGenre(g)}>
            {label(g)} <span className="text-t3">{formatNumber(books.filter((b) => (b.info.genre ?? "") === g).length, locale)}</span>
          </button>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((b) => (
          <li key={b.slug}>
            <Link href={bookHref(b.slug)} className="card flex h-full flex-col gap-1.5 p-4 hover:border-root" data-book={b.slug}>
              <span className="ar-classical line-clamp-2 text-[21px] leading-snug" lang="ar" dir="rtl">{b.title_ar}</span>
              {!ar && <span className="text-[13px] text-t2">{b.title_en}</span>}
              <span className="text-[12.5px] text-t3">
                <bdi lang="ar">{b.author_ar}</bdi> {ar ? `(ت ${formatNumber(b.info.death_ah, locale)}هـ)` : `(d. ${b.info.death_ah} AH)`}
              </span>
              <span className="mt-auto flex flex-wrap gap-1.5 pt-2 text-[12px]">
                {b.info.genre && <span className="state-chip">{label(b.info.genre)}</span>}
                <span className="state-chip">{t("words", cnt(b.token_count, locale))}</span>
                <span className="state-chip">{t(citedBy(b.info).label)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
