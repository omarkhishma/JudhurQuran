import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookShelf, type ShelfBook } from "@/components/books/BookShelf";
import { Sources } from "@/components/hadith/Sources";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { api } from "@/lib/api";
import type { Book } from "@/lib/books";
import { localized } from "@/lib/seo";

export const revalidate = 86400;

async function load(): Promise<{ books: ShelfBook[]; source: Book["source"] }> {
  const shelf = await api<{ data: (ShelfBook & { kind: string })[] }>("/texts");
  const books = shelf.data.filter((t) => t.kind === "book");
  // the source is the same for every book: OpenITI's release, its credit and licence
  const first = books.length ? await api<Book>(`/texts/${books[0].slug}`) : null;
  return { books, source: first?.source ?? null };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/books">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "books" });
  return { title: t("homeTitle"), description: t("homeLead"), alternates: localized(locale, "/books") };
}

/** The books (P11.3): the shelf's 37 classical books in the order their authors died, each with its author, its
 * subject where OpenITI gives one, its size and how its paragraphs are cited; a search over their words; the source. */
export default async function BooksPage({ params }: PageProps<"/[locale]/books">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("books");
  const { books, source } = await load();
  const ar = locale === "ar";
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[ar ? "الرئيسية" : "Home", "/"], [t("homeTitle"), "/books"]])} />
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold">{t("homeTitle")}</h1>
        <p className="max-w-[72ch] leading-relaxed text-t2">{t("homeLead")}</p>
      </header>
      <form action={ar ? "/search" : "/en/search"} method="get" role="search" className="mb-6 flex max-w-[560px] flex-wrap gap-2">
        <label htmlFor="books-q" className="sr-only">{t("searchLabel")}</label>
        <input id="books-q" name="q" dir="rtl" lang="ar" required className="field min-w-0 flex-1 text-[16px]" placeholder={t("searchPlaceholder")} />
        <input type="hidden" name="k" value="books" />
        <button type="submit" className="btn btn-primary">{t("searchGo")}</button>
      </form>
      <BookShelf books={books} />
      <section className="mt-10 max-w-[80ch]" aria-labelledby="rules-h">
        <h2 id="rules-h" className="mb-2 text-[15px] font-semibold text-t2">{t("rulesTitle")}</h2>
        <p className="text-[13px] leading-relaxed text-t3">{t("rulesNote")}</p>
      </section>
      <Sources sources={[source]} />
    </div>
  );
}
