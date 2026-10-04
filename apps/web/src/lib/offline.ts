"use client";

import type { Bookmark } from "@/lib/store/saved";

/**
 * Offline reading (PLAN P12): the service worker (public/sw.js) keeps copies of the reading pages this browser read
 * and of their data; the reader's saved items are kept too, sent to it as they are saved. Nothing leaves the browser.
 */
export const WORKER = "/sw.js";

/** The pages and the data a saved item needs to be read without a connection: a word's entry opens at its first
 * place, so its sūra's page is kept with it. */
export async function keptFor(b: Bookmark): Promise<{ pages: string[]; data: string[] }> {
  const enc = encodeURIComponent;
  if (b.kind === "lemma") {
    const first = await fetch(`/api/v1/words/${enc(b.key)}?limit=1`)
      .then((r) => (r.ok ? (r.json() as Promise<{ attestations: { items: { location: string }[] } }>) : null))
      .then((w) => w?.attestations.items[0]?.location ?? null)
      .catch(() => null);
    const surah = first?.split(":")[0];
    return {
      pages: [`/read?w=${enc(b.key)}`, ...(surah ? [`/quran/${surah}`] : [])],
      // the entry, and what the reader beside it asks for: the sūras, this one's roots, the recitations
      data: [
        `/api/v1/words/${enc(b.key)}?limit=12`,
        ...(first ? [`/api/v1/words/${enc(b.key)}?limit=12&at=${first}`] : []),
        ...(surah ? [`/api/v1/surahs`, `/api/v1/surahs/${surah}/roots`, `/api/v1/recitations`, `/api/v1/lemmas/roots`] : []),
      ],
    };
  }
  if (b.kind === "verse") {
    const [s, a] = b.key.split(":");
    return { pages: [`/quran/${s}/${a}`], data: [`/api/v1/verses/${b.key}`, `/api/v1/verses/${b.key}/knowledge`] };
  }
  if (b.kind === "root") return { pages: [`/roots/${enc(b.key)}`], data: [`/api/v1/roots/${enc(b.key)}`] };
  return { pages: [], data: [`/api/v1/words/${enc(b.key)}`] };
}

/** Ask the worker to keep these, when there is one. */
export function keep(items: { pages: string[]; data: string[] }): void {
  const sw = typeof navigator !== "undefined" ? navigator.serviceWorker?.controller : null;
  if (sw && (items.pages.length || items.data.length)) sw.postMessage({ type: "jadhr-keep", ...items });
}
