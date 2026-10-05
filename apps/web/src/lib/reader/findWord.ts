/**
 * A word marked where a tafsir names it (B3, PLAN §8): the tafsir's text and the word compared with their vowels,
 * Quranic signs and tatweel set aside and the seats of hamza, alif maqsura and ta marbuta read alike — the tafsirs
 * write in today's spelling, with or without vowels — as a whole word, a glued و ف ب ك ل allowed before it, the
 * article too. The text itself is never changed: the marks are ranges over it.
 */

const SET_ASIDE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/;
const ALIKE: Record<string, string> = { "\u0623": "\u0627", "\u0625": "\u0627", "\u0622": "\u0627", "\u0671": "\u0627", "\u0649": "\u064A", "\u0629": "\u0647" };
const LETTER = /[\u0621-\u064A\u0671-\u06D3]/;
const GLUED = "\u0648\u0641\u0628\u0643\u0644";

/** The text folded, and for each folded character the index of the character it came from. */
export function fold(text: string): { s: string; at: number[] } {
  let s = "";
  const at: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (SET_ASIDE.test(c)) continue;
    s += ALIKE[c] ?? c;
    at.push(i);
  }
  return { s, at };
}

/** Where the word stands in the text: ranges [from, to) of the text, in order, its vowels inside them. */
export function findWord(text: string, word: string): [number, number][] {
  const target = fold(word).s.replace(/\s+/g, "");
  if (target.length < 2) return [];
  const forms = [target];
  // the word without its article, where the tafsir names it so (الرحمن ← رحمن is never taken: see below)
  if (target.startsWith("\u0627\u0644") && target.length > 4) forms.push(target.slice(2));
  const { s, at } = fold(text);
  const found: [number, number][] = [];
  for (const f of forms) {
    for (let from = s.indexOf(f); from !== -1; from = s.indexOf(f, from + 1)) {
      const end = from + f.length;
      // a glued و ف ب ك ل (two at most) belongs to the same word; past it, the word must start
      let start = from;
      while (start > 0 && from - start < 2 && GLUED.includes(s[start - 1])) start--;
      const before = start > 0 ? s[start - 1] : " ";
      const after = end < s.length ? s[end] : " ";
      if (LETTER.test(before) || LETTER.test(after)) continue;
      // the bare form found inside the article's own word is the article's form, already taken
      if (f !== target && from >= 2 && s.slice(from - 2, from) === "\u0627\u0644") continue;
      let to = at[end - 1] + 1;
      while (to < text.length && SET_ASIDE.test(text[to])) to++;
      found.push([at[start], to]);
    }
  }
  found.sort((a, b) => a[0] - b[0]);
  return found.filter((r, i) => i === 0 || r[0] >= found[i - 1][1]);
}
