/**
 * Arabic normalisation — the TypeScript twin of `jadhr_arabic.normalize` (Python). Both implement
 * `packages/arabic-spec/README.md` and must pass `packages/arabic-spec/vectors.json`.
 * Nothing here is displayed in place of a source text, except `displayBare` (the tashkīl-off view of
 * non-Quranic text — the mushaf is never stripped, decision D7).
 */

// Harakat and combining hamzas, dagger alef, Quranic small high signs, annotation/pause signs,
// Extended-A marks (incl. open tanwīn), tatweel and invisible format characters.
const STRIP =
  /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣣ࣡-ࣿـ​-‏؜﻿]/g;

const FOLD: Record<string, string> = {
  "ٱ": "ا", // ٱ
  "أ": "ا", // أ
  "إ": "ا", // إ
  "آ": "ا", // آ
  "ٲ": "ا",
  "ٳ": "ا",
  "ٵ": "ا",
  "ى": "ي", // ى → ي
  "ی": "ي", // Persian yeh → ي
  "ة": "ه", // ة → ه
  "ؤ": "و", // ؤ → و
  "ئ": "ي", // ئ → ي
  "ک": "ك", // keheh → ك
  " ": " ",
};
const FOLD_RE = new RegExp(`[${Object.keys(FOLD).join("")}]`, "g");

export function stripMarks(text: string): string {
  return text.normalize("NFC").replace(STRIP, "");
}

/** The tashkīl-off view: marks stripped, alef wasla written as a plain alef; hamza carriers kept. */
export function displayBare(text: string): string {
  return stripMarks(text).replace(/ٱ/g, "ا");
}

export function fold(text: string): string {
  return text.replace(FOLD_RE, (c) => FOLD[c]);
}

/** The matching key: strip marks, fold variants, collapse whitespace, trim. */
export function normalize(text: string): string {
  return fold(stripMarks(text)).replace(/\s+/g, " ").trim();
}

const UTHMANI_ONLY = /[ٰٱۖ-ࣰۭ-ࣲ]/;

/** Copied from a mushaf (dagger alef, alef wasla, Quranic signs) rather than typed in everyday spelling. */
export function isUthmani(text: string): boolean {
  return UTHMANI_ONLY.test(text);
}

export function hasArabic(text: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿ]/.test(text);
}

/** True when the text carries at least one diacritic. */
export function hasMarks(text: string): boolean {
  return stripMarks(text) !== text.normalize("NFC").replace(/ـ/g, "");
}
