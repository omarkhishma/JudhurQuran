import type { GraphEdge, GraphKind, GraphNode } from "./types";

/**
 * Published maps (P8.5), what the server's pages and the browser share: the record's shape, the addresses, the
 * address made from a title as the API makes it, and the citation. No "use client" here: a server page calls these.
 */

export type MapCounts = { cards: number; roots: number; words: number; lead: string | null };

/** A card as a change names it: its kind and the words it shows. */
export type ChangedCard = { id: string; kind: string; name: string };
export type VersionChanges = { added: ChangedCard[]; removed: ChangedCard[]; moved: number; links_added: number; links_removed: number };
export type ChangeCounts = { added: number; removed: number; moved: number; links_added: number; links_removed: number };

export type PublishedMap = {
  slug: string;
  version: number;
  latest: number;
  title: string;
  description: string;
  kind: GraphKind;
  doc: { version: number; nodes: GraphNode[]; edges: GraphEdge[] };
  doc_version: number;
  counts: MapCounts;
  published_at: string;
  first_published_at: string;
  updated_at: string;
  author: { name: string | null };
  fork_count: number;
  cite_count: number;
  forked_from: { slug: string; version: number; title: string | null } | null;
  /** each with what it changed in the one before it, counted (B59; the latest twenty) */
  versions: { version: number; title: string; counts: MapCounts; published_at: string; changes?: ChangeCounts }[];
  /** what the version shown changed in the one before it, its cards named (B59); null for the first */
  changes: VersionChanges | null;
  mine: boolean;
  /** the owner's own id for the map in their browser: given to the owner only */
  local_id?: string;
  /** open reports, for the editorial board only */
  reports?: { id: number; version: number; reason: string; created_at: string }[];
};

export type PublishedRow = Pick<PublishedMap, "slug" | "title" | "description" | "kind" | "counts" | "latest" | "fork_count" | "cite_count" | "updated_at" | "first_published_at" | "author"> & {
  local_id?: string;
};

/**
 * The licence a published map carries (EDT-335) is the owner's to choose: until then this is null and every page
 * says what holds without naming one — each quotation under its source's terms, the author's own words theirs.
 */
export const PUBLISHED_LICENCE: { ar: string; en: string; url: string } | null = null;

// ─── addresses ───────────────────────────────────────────────────────────────

/** The map's page; with a version, that version's own address (what a citation names). */
export const publishedPath = (slug: string, version?: number) => `/g/${encodeURIComponent(slug)}${version ? `?v=${version}` : ""}`;
/** The map in the editor, read-only, in a window of its own (EDT-025, EDT-340). */
export const publishedMapPath = (slug: string, version?: number) => `/g/${encodeURIComponent(slug)}/map${version ? `?v=${version}` : ""}`;

export type EmbedOptions = { entry: boolean; folded: boolean; dark: boolean; version?: number };
/** The map framed: no header, the display options as parameters (EDT-329, EDT-333, EDT-334). */
export function embedPath(slug: string, o: EmbedOptions): string {
  const q = new URLSearchParams({ entry: o.entry ? "1" : "0", folded: o.folded ? "1" : "0", theme: o.dark ? "dark" : "light", ...(o.version ? { v: String(o.version) } : {}) });
  return `/embed/g/${encodeURIComponent(slug)}?${q}`;
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
/** The snippet a site pastes to show the map (EDT-333): the frame named for screen readers, loaded when reached. */
export const embedSnippet = (origin: string, prefix: string, slug: string, title: string, o: EmbedOptions) =>
  `<iframe src="${origin}${prefix}${embedPath(slug, o)}" title="${attr(title)}" width="100%" height="520" style="border:0" loading="lazy"></iframe>`;

// ─── the address from a title, as the API makes it ──────────────────────────

const LETTERS = "a-z0-9\u0621-\u063a\u0641-\u064a";
// vowel marks, the small high letters, superscript alef, tatweel and the mushaf's annotation marks
const MARKS = /[\u0610-\u061a\u064b-\u065f\u0670\u0640\u06d6-\u06ed]/g;
const arabic = (c: string) => c >= "\u0600" && c <= "\u06ff";

function fold(c: string): string {
  if (arabic(c)) return c;
  const d = c.normalize("NFKD");
  const kept = [...d].filter(arabic);
  if (kept.length) return kept.join("");
  return d.replace(/[^\u0000-\u007f]/g, "") || "-";
}

/** An address from a title or from what the owner types (QAN-23): the API's rules (jadhr_api.published.slugify),
 * shown while typing; the API's answer is the address. */
export function slugify(raw: string): string {
  let s = [...(raw ?? "").normalize("NFC").toLowerCase()].map(fold).join("");
  s = s
    .normalize("NFC")
    .replace(MARKS, "")
    .replace(/\u0671/g, "\u0627")
    .replace(/\u06cc/g, "\u064a")
    .replace(/\u06a9/g, "\u0643")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  s = s.replace(new RegExp(`[^${LETTERS}]+`, "g"), "-").replace(/^-+|-+$/g, "");
  return s.slice(0, 60).replace(/-+$/g, "");
}

// ─── citation ────────────────────────────────────────────────────────────────

export type MapCiteFormat = "arabic" | "chicago" | "apa" | "bibtex" | "ris";
export const MAP_CITE_FORMATS: MapCiteFormat[] = ["arabic", "chicago", "apa", "bibtex", "ris"];

/** A short stable key for BibTeX, whose keys take no Arabic letters. */
function key(slug: string, version: number): string {
  let h = 5381;
  for (const c of slug) h = ((h * 33) ^ c.codePointAt(0)!) >>> 0;
  return `jadhr_map_${h.toString(36)}_v${version}`;
}

/** A version of a map cited (EDT-332, the union of the design's BibTeX, RIS and plain text with the dataset's forms):
 * its author as they named themselves, its title, its version and date, and the version's own address. */
export function mapCitation(format: MapCiteFormat, m: Pick<PublishedMap, "slug" | "version" | "title" | "author" | "published_at">, address: string, anonymous: { ar: string; en: string }): string {
  const day = m.published_at.slice(0, 10);
  const year = day.slice(0, 4);
  switch (format) {
    case "arabic":
      return `${m.author.name ?? anonymous.ar}. «${m.title}». خريطة في جذر، الإصدار ${m.version}، ${day}. ${address}`;
    case "chicago":
      return `${m.author.name ?? anonymous.en}. “${m.title}.” Jadhr map, version ${m.version}, ${day}. ${address}.`;
    case "apa":
      return `${m.author.name ?? anonymous.en}. (${year}). ${m.title} [Map, version ${m.version}]. Jadhr. ${address}`;
    case "bibtex":
      return [`@misc{${key(m.slug, m.version)},`, `  author = {${m.author.name ?? anonymous.en}},`, `  title = {${m.title}},`, `  year = {${year}},`, `  howpublished = {Jadhr map, version ${m.version}},`, `  url = {${address}},`, `}`].join("\n");
    case "ris":
      return ["TY  - ELEC", `AU  - ${m.author.name ?? anonymous.en}`, `TI  - ${m.title}`, `PY  - ${year}`, `DA  - ${day}`, `ET  - ${m.version}`, "PB  - Jadhr", `UR  - ${address}`, "ER  - "].join("\n");
  }
}
