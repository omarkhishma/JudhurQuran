import type { BoardSource } from "./types";

/**
 * The works the editorial board's entry rests on, as one line (P3.0c): each by its title in the reader's language —
 * the API resolves the ids from the sources registry — and where in it; a work it does not know keeps its id.
 */
export function sourceLine(sources: BoardSource[] | undefined, locale: string): string {
  return (sources ?? [])
    .map((x) => {
      const title = (locale === "ar" ? x.title_ar : (x.title_en ?? x.title_ar)) || x.work;
      return x.ref ? `${title} ${x.ref}` : title;
    })
    .join(" • ");
}
