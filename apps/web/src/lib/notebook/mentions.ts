/**
 * @-mentions in a note (NTB-26…28, NTB-Q04): a verse or a range (@2:255, @٢:٢٥٥, @2:255-257), a root in
 * Arabic letters with or without spaces (@ع ل م, @علم) or in Latin (@k-t-b), and otherwise one word, Arabic or
 * transliterated (@ʿilm), which may name a word or a lexicon (@لسان, @Lisan); a hadith or a book's paragraph by its
 * text and number (B58), the text named as its address names it or by a word of its Arabic title (@bukhari:1,
 * @shafici-risala:40, @البخاري:١, @أبي داود:٣٠). The prototype's matcher dropped the colon (so @2:32 never resolved),
 * lost the macron and swallowed the words that followed (NTB-27).
 */
export type Mention =
  | { kind: "verse"; raw: string; surah: number; ayah: number; to: number | null }
  | { kind: "root"; raw: string; query: string }
  | { kind: "word"; raw: string; query: string }
  | { kind: "passage"; raw: string; name: string; ref: string };

const DIGITS: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
const latinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => DIGITS[d]);

const VERSE = /^([0-9٠-٩]{1,3})\s*[:：]\s*([0-9٠-٩]{1,3})(?:\s*[-–]\s*([0-9٠-٩]{1,3}))?/;
const SPACED_ROOT = /^[ء-ي](?:\s+[ء-ي]){2,3}(?![ء-ي])/;
const LATIN_ROOT = /^[a-zʿʾ'’ḥṣḍṭẓġšṯḏḫ]{1,2}(?:-[a-zʿʾ'’ḥṣḍṭẓġšṯḏḫ]{1,2}){2,3}(?![a-z-])/i;
// a text's address (bukhari, shafici-risala) or one or two words of its Arabic title, then its number: 1, 12.3, s12
const PASSAGE = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*|[ء-ي]+(?:\s[ء-ي]+)?)\s*[:：]\s*(s?[0-9٠-٩]{1,6}(?:[._][0-9٠-٩]{1,4})?)(?![0-9٠-٩])/i;
const WORD = /^[^\s@،,.;:()«»"؟?!]+/;

export function parseMentions(text: string): Mention[] {
  const out: Mention[] = [];
  const seen = new Set<string>();
  for (let i = text.indexOf("@"); i >= 0; i = text.indexOf("@", i + 1)) {
    // an e-mail address is not a mention; an Arabic «و» or «ف» joined before @ is just writing (و@ع ل م)
    if (i > 0 && /[A-Za-z0-9._%+-]/.test(text[i - 1])) continue;
    const rest = text.slice(i + 1);
    let m: Mention | null = null;
    let v: RegExpMatchArray | null;
    if ((v = rest.match(VERSE))) {
      const [surah, ayah, to] = [v[1], v[2], v[3]].map((x) => (x ? Number(latinDigits(x)) : null));
      m = { kind: "verse", raw: v[0], surah: surah!, ayah: ayah!, to: to && to > ayah! ? to : null };
    } else if ((v = rest.match(PASSAGE))) {
      m = { kind: "passage", raw: v[0], name: /^[a-z]/i.test(v[1]) ? v[1].toLowerCase() : v[1], ref: latinDigits(v[2]).replace("_", ".").toLowerCase() };
    } else if ((v = rest.match(SPACED_ROOT)) || (v = rest.match(LATIN_ROOT))) {
      m = { kind: "root", raw: v[0], query: v[0] };
    } else if ((v = rest.match(WORD))) {
      m = { kind: "word", raw: v[0], query: v[0] };
    }
    if (m && !seen.has(`${m.kind}:${m.raw}`)) {
      seen.add(`${m.kind}:${m.raw}`);
      out.push(m);
    }
  }
  return out;
}

/** Latin with its diacritics and ʿ ʾ dropped, for matching a lexicon's name typed either way (Lisān, Lisan). */
export const foldLatin = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[ʿʾ'’`-]/g, "").toLowerCase();
