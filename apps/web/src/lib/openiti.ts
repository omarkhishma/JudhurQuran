/**
 * Display helpers for texts taken from OpenITI's cleaned files. The stored text is never changed; only how it
 * is drawn. Its typings mark the break between a verse's two hemistichs with a lone "%" («(صدر % عجز)», or «(صدر %)»
 * when only one half is quoted): drawn as the wide gap a printed book leaves there.
 */

// a "%" standing alone: between spaces, or against the parenthesis of a half-verse quoted alone
const HEMISTICH = /(^|[\s(])%(?=[\s)]|$)/g;
const GAP = "\u2003\u2003";

export function showHemistichs(text: string): string {
  return text.replace(HEMISTICH, (_, before: string) => `${before.trim() ? before : ""}${GAP}`);
}
