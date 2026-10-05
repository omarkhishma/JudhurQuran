import type { ChapterLine, Form, Segment, Source } from "@/lib/hadith";

/**
 * The books (P11.3): the shelf's 37 OpenITI versions as texts of the generic model — the author's text by rules applied
 * to every book (the editor's footnote markers and verse references out, his brackets kept and marked), each paragraph
 * with the printed pages it stands on where the version's pages passed the check, and its citation. The shapes the API
 * serves (services/api: texts.py).
 */

export type Edition = { editor?: string; number?: string; publisher?: string; place?: string; year?: string; volumes?: string };

export type BookInfo = {
  death_ah: number;
  work: string;
  version: string;
  genre: string | null;
  short_title_ar: string;
  author_full_ar: string | null;
  edition: Edition;
  follows_print: boolean | null;
  pages_trusted: boolean;
  numbered_by_editor: boolean;
  pages_why: { why: "card" | "markers" | "unknown" | "backs" | "median" | "turath"; n?: number; of?: number }[];
  volumes: number | null;
};

export type Book = {
  slug: string;
  kind: "book";
  title_ar: string;
  title_en: string;
  author_ar: string | null;
  author_en: string | null;
  meta_ar: string | null;
  era_year: number | null;
  chapter_count: number;
  passage_count: number;
  token_count: number;
  info: BookInfo;
  chapters: BookChapterLine[];
  source: Source | null;
};

/** A chapter as a contents line; a book without headings is read in runs of printed pages (a label of ours). */
export type BookChapterLine = ChapterLine & { meta: { label?: "pages" | "opening"; volume?: number; pages_from?: number } | null };

/** A paragraph's citation: its stable key, its Arabic form, what it is cited by, and the author, work and editor a page of
 * it is cited after (B56). */
export type Cite = { key: string; ar: string; by: "page" | "number" | "section"; base?: string };

export type ParagraphMeta = {
  pages?: [number, number][];
  on_page?: number;
  editor_number?: string;
  editor_section?: string;
  editor?: [number, number][];
  quran_refs?: [number, number, number][];
  /** where a printed page begins inside the paragraph (B56): the character its first word stands at, the volume, the
   * page it opens and the last page of the run after it (more than one where a page's own turn is not marked) */
  breaks?: [number, number, number, number][];
};

/** The printed pages a place in a paragraph stands on (B56): a volume and a first and last page — one page where the
 * version marks the turns around it, a range where it does not. Null where the paragraph has no pages, or runs over
 * two volumes with no turn marked. */
export function pagesAt(meta: ParagraphMeta, offset: number): { v: number; from: number; to: number } | null {
  const pages = meta.pages;
  if (!pages?.length) return null;
  const [first, last] = [pages[0], pages[pages.length - 1]];
  const turns = meta.breaks ?? [];
  if (!turns.length) return first[0] === last[0] ? { v: first[0], from: first[1], to: last[1] } : null;
  const turn = [...turns].reverse().find(([o]) => o <= offset);
  return turn ? { v: turn[1], from: turn[2], to: turn[3] } : { v: first[0], from: first[1], to: first[1] };
}

export type Paragraph = {
  ref: string;
  ordinal: number;
  chapter: number;
  ar_full: string;
  token_count: number;
  meta: ParagraphMeta;
  cite: Cite;
  segments: BookSegment[];
  words: number[];
};

/** A piece of a paragraph: a word (``w``) or what lies between words; ``e`` inside the editor's brackets. */
export type BookSegment = Segment & { e?: 1 };

export type BookChapter = {
  text: { slug: string; kind: string; title_ar: string; title_en: string; author_ar: string | null; author_en: string | null };
  chapter: { ordinal: number; title_ar: string; title_en: string; level: number; passage_count: number; total: number; meta: BookChapterLine["meta"] };
  path: { ordinal: number; title_ar: string; title_en: string }[];
  children: BookChapterLine[];
  prev: { ordinal: number; title_ar: string; title_en: string; meta: BookChapterLine["meta"] } | null;
  next: { ordinal: number; title_ar: string; title_en: string; meta: BookChapterLine["meta"] } | null;
  passages: Paragraph[];
  forms: { [id: string]: Form };
  offset: number;
  limit: number;
  total: number;
};

export type BookParagraph = {
  text: BookChapter["text"];
  ref: string;
  /** the paragraph's own address (book:…:n), which a correction names (B58) */
  uri: string;
  cite: Cite;
  path: { ordinal: number; title_ar: string; title_en: string }[];
  ar_full: string;
  meta: ParagraphMeta;
  segments: BookSegment[];
  words: number[];
  forms: { [id: string]: Form };
  roots: string[];
  roots_low: string[];
  prev: string | null;
  next: string | null;
  source: Source | null;
};

export const bookHref = (slug: string) => `/books/${slug}`;
export const chapterHref = (slug: string, ordinal: number, page = 1) => `/books/${slug}/${ordinal}${page > 1 ? `?page=${page}` : ""}`;
export const paragraphHref = (slug: string, ref: string) => `/books/${slug}/p/${encodeURIComponent(ref)}`;
export const verseHref = (surah: number, ayah: number) => `/quran/${surah}/${ayah}`;

/** A slug the shelf can hold: lower-case letters, digits and dashes. */
export const isBookSlug = (s: string) => /^[a-z0-9-]{3,80}$/.test(s);

/** How a book's paragraphs are cited: by printed page where its pages passed the check, else by its editor's
 * paragraph numbers where he numbers them, else by section — with the messages that say so. */
export function citedBy(info: Pick<BookInfo, "pages_trusted" | "numbered_by_editor">) {
  if (info.pages_trusted) return { label: "pagesCited", note: "pagesCitedNote" } as const;
  if (info.numbered_by_editor) return { label: "pagesByNumber", note: "pagesByNumberNote" } as const;
  return { label: "pagesNotCited", note: "pagesNotCitedNote" } as const;
}
