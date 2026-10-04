"use client";

import { getJSON } from "@/lib/reader/api";

/**
 * The dataset's releases and the public API (P10, research 18): what `/data` reads. Every call is a plain read of
 * the public API — no account, nothing kept.
 */

export type ReleaseFile = { path: string; table: string | null; format: string | null; rows: number; bytes: number; sha256: string; notice: string | null; held: string | null; available: boolean; url: string };
export type Hold = { id?: string; tables?: string[]; data: string; why: string; why_ar?: string; decision: string };
export type ReleaseSummary = {
  version: string;
  dataset: string;
  built_at: string | null;
  recorded_at: string | null;
  published_at: string | null;
  doi: string | null;
  manifest_sha256: string;
  counts: { files: number; available: number; held: number };
  url: string;
};
export type Release = ReleaseSummary & {
  files: ReleaseFile[];
  sources: { id: string; title_en: string; url: string; license: string; attribution_en: string }[];
  publication_hold: Hold[];
  excluded: { data: string; reason: string; data_ar?: string; reason_ar?: string }[];
  manifest_url: string;
  data_counts: Record<string, number> | null;
};
export type Source = { id: string; title_ar: string; title_en: string; url: string; license: string; role?: string; role_ar?: string };
export type PublicIndex = {
  endpoints: { method: string; path: string; summary: string }[];
  limits: { per_minute_without_key: number; per_minute_with_key: number };
  openapi: string;
};

export const getReleases = () => getJSON<{ data: ReleaseSummary[] }>("/releases");
export const getRelease = (version: string) => getJSON<Release>(`/releases/${encodeURIComponent(version)}`);
export const getMeta = () => getJSON<{ dataset: { version: string; counts: Record<string, number>; loaded_at: string } }>("/meta");
export const getSources = () => getJSON<Source[] | { data: Source[] }>("/sources").then((x) => (Array.isArray(x) ? x : x.data));
export const getPublicIndex = () => getJSON<{ data: PublicIndex }>("/public").then((x) => x.data);

/** A release's address on this site: what a citation names, serving the release with its manifest's hash. */
export const releaseAddress = (origin: string, version: string) => `${origin}/api/v1/releases/${version}`;

export type CiteFormat = "bibtex" | "ris" | "chicago" | "apa" | "arabic";
export const CITE_FORMATS: CiteFormat[] = ["bibtex", "ris", "chicago", "apa", "arabic"];

/** The dataset cited (DAT-18…22, Q06): BibTeX, RIS, Chicago, APA and an Arabic form; the DOI when one is minted,
 * else the release's own address — never a placeholder DOI (DAT-Q04). */
export function citation(format: CiteFormat, r: Pick<ReleaseSummary, "version" | "built_at" | "doi">, address: string): string {
  const year = (r.built_at ?? "").slice(0, 4) || String(new Date().getUTCFullYear());
  const link = r.doi ? `https://doi.org/${r.doi}` : address;
  const id = `jadhr_${r.version.replace(/\./g, "_")}`;
  switch (format) {
    case "bibtex":
      return [
        `@dataset{${id},`,
        `  title = {Jadhr — Quranic Roots Dataset},`,
        `  author = {{Jadhr}},`,
        `  year = {${year}},`,
        `  version = {${r.version}},`,
        ...(r.doi ? [`  doi = {${r.doi}},`] : []),
        `  url = {${link}},`,
        `  note = {Derived layers CC BY-SA 4.0; each source under its own licence, as the release manifest states}`,
        `}`,
      ].join("\n");
    case "ris":
      return ["TY  - DATA", "TI  - Jadhr — Quranic Roots Dataset", "AU  - Jadhr", `PY  - ${year}`, `ET  - ${r.version}`, ...(r.doi ? [`DO  - ${r.doi}`] : []), `UR  - ${link}`, "ER  - "].join("\n");
    case "chicago":
      return `Jadhr. Quranic Roots Dataset, version ${r.version}. ${year}. ${link}.`;
    case "apa":
      return `Jadhr. (${year}). Quranic roots dataset (Version ${r.version}) [Data set]. ${link}`;
    case "arabic":
      return `جذر. بيانات جذور القرآن، الإصدار ${r.version}، ${year}. ${link}`;
  }
}
