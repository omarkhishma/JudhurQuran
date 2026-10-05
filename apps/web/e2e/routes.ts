import type { Page } from "@playwright/test";

/** Every route of the site (P1.9): the static ones, and the dynamic ones taken from the API — shared by the route
 * sweep and the accessibility sweep. */

const enc = encodeURIComponent;

export async function dynamicRoutes(page: Page): Promise<string[]> {
  const j = async <T,>(p: string) => (await (await page.request.get(`/api/v1${p}`)).json()) as T;
  const texts = await j<{ data: { slug: string; kind: string }[] }>("/texts");
  const slug = texts.data.find((t) => t.kind === "book")!.slug;
  const book = await j<{ chapters: { ordinal: number }[] }>(`/texts/${slug}`);
  const first = book.chapters[0].ordinal;
  const ch = await j<{ passages: { ref: string }[] }>(`/texts/${slug}/chapters/${first}?limit=1`);
  return [`/books/${slug}`, `/books/${slug}/${first}`, `/books/${slug}/p/${enc(ch.passages[0].ref)}`];
}

export const STATIC = [
  "/",
  "/quran",
  "/quran/1",
  "/quran/2/255",
  "/mushaf",
  "/mushaf/50",
  "/word/1:1:1",
  "/roots",
  `/roots/${enc("علم")}`,
  `/roots/${enc("علم")}/count`,
  "/graph",
  `/graph/root/${enc("علم")}`,
  "/split",
  "/library",
  `/search?q=${enc("علم")}`,
  `/concordance?root=${enc("علم")}`,
  "/analyse",
  "/explore",
  "/notebook",
  "/review",
  "/classroom",
  "/g",
  "/me",
  "/data",
  "/developers",
  "/sources",
  "/about",
  "/privacy",
  "/saved",
  "/signin",
  "/dictionary",
  `/dictionary/letter/${enc("ء")}`,
  `/dictionary/${enc("علم")}`,
  `/dictionary/${enc("علم")}/texts`,
  "/hadith",
  "/hadith/bukhari",
  "/hadith/bukhari/1",
  "/hadith/bukhari/kitab/1",
  "/hadith/narrators",
  "/books",
  "/books/catalogue",
];

