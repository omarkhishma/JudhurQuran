import { normalize } from "./arabic/normalize";

/**
 * Find glossary terms inside running text (RDR-273, RDR-563): one pattern of every label, longest
 * first so «الفعل المزيد» wins over «الفعل» and "Form II" over "Form I", metacharacters escaped, and
 * Unicode-aware edges — JavaScript's `\b` only knows ASCII letters, so it would match «الأمر» inside
 * «الأمرين». A term matches only when no letter or combining mark touches either side.
 *
 * Labels and text are matched by the shared normalisation (P1.3a, packages/arabic-spec): an Arabic letter matches the
 * spellings the spec folds into it (أ إ آ ٱ as ا, ى ی ئ as ي, ة as ه, ؤ as و, ک as ك), and vowel marks and tatweel
 * may stand between letters — so a vowelled «الْفِعْلُ الْمَزِيدُ» finds its term, and the text is shown as written.
 */
export type Run = { text: string; term?: string };

const CLASSES: Record<string, string> = {
  "\u0627": "\u0627\u0623\u0625\u0622\u0671\u0672\u0673\u0675",
  "\u064a": "\u064a\u0649\u06cc\u0626",
  "\u0647": "\u0647\u0629",
  "\u0648": "\u0648\u0624",
  "\u0643": "\u0643\u06a9",
};
// what may stand after a letter without changing the word: marks, the Quranic small signs, tatweel
const BETWEEN = "[\\p{M}\u0640]*";
const ARABIC = /[\u0600-\u06ff]/;
const escape = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A label as a pattern over running text: Arabic letters by their folding classes with marks between, Latin as is. */
function pattern(label: string): string {
  if (!ARABIC.test(label)) return escape(label);
  return [...normalize(label)]
    .map((c) => (c === " " ? "\\s+" : CLASSES[c] ? `[${CLASSES[c]}]${BETWEEN}` : ARABIC.test(c) ? `${escape(c)}${BETWEEN}` : escape(c)))
    .join("");
}

const keyOf = (text: string) => (ARABIC.test(text) ? normalize(text) : text.toLocaleLowerCase());

export function splitTerms(text: string, labels: { key: string; label: string }[]): Run[] {
  const usable = labels.filter((l) => l.label.trim().length > 1);
  if (!text || !usable.length) return [{ text }];
  const byLabel = new Map(usable.map((l) => [keyOf(l.label), l.key]));
  const alternatives = [...byLabel.keys()].sort((a, b) => b.length - a.length).map(pattern);
  const re = new RegExp(`(?<![\\p{L}\\p{M}])(${alternatives.join("|")})(?![\\p{L}\\p{M}])`, "giu");
  const out: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    out.push({ text: m[0], term: byLabel.get(keyOf(m[0])) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
