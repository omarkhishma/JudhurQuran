import type { BookChapterLine } from "@/lib/books";
import { toArabicDigits } from "@/lib/format";

type T = (key: "opening" | "pagesRun" | "pagesRunVolume", values?: Record<string, string>) => string;

/** A chapter's name: its heading, or — where the book has none — our label for it, said as ours: the text before the
 * first heading, or a run of printed pages. */
export function chapterLabel(c: Pick<BookChapterLine, "title_ar" | "meta">, t: T, locale: string, volumes: number): string {
  if (c.title_ar) return c.title_ar;
  const d = (n: number) => (locale === "ar" ? toArabicDigits(n) : String(n));
  if (c.meta?.label === "pages") {
    const from = d(c.meta.pages_from ?? 1);
    return volumes > 1 ? t("pagesRunVolume", { v: d(c.meta.volume ?? 1), from }) : t("pagesRun", { from });
  }
  return t("opening");
}
