/** A reader's text as an identifier (P1.7a): `user:<id>`, a passage `user:<id>:<n>`, a word in it `user:<id>:<n>:<k>`
 * (both counted from 1) — the Quran's `quran:2:255:3` in the reader's own namespace, so nothing of the reader's ever
 * shares a name with a text of the library. Only this browser, and the reader's account, can open what it names. */
export const userUri = (id: string, passage?: number, word?: number) =>
  ["user", id, passage, passage === undefined ? undefined : word].filter((x) => x !== undefined).join(":");

/** Where the reader is in their text is kept under the text's identifier; before identifiers it was `text:<id>`. */
export const LEGACY_PROGRESS = "text:";

/** The places kept before identifiers, under `text:<id>` for a reader's text, moved to its identifier `user:<id>`;
 * one already under the identifier is newer and stays. */
export function progressByIdentifier<T>(progress: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(progress)) if (!k.startsWith(LEGACY_PROGRESS)) out[k] = v;
  for (const [k, v] of Object.entries(progress)) if (k.startsWith(LEGACY_PROGRESS)) out[userUri(k.slice(LEGACY_PROGRESS.length))] ??= v;
  return out;
}
