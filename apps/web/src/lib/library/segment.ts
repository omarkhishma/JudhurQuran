/**
 * A pasted text cut into passages and words (P4.4, LIB-45): a blank line ends a passage; a long paragraph is
 * cut after a sentence end (. ؟ ! ؛ ۔) once it passes the target length. Words are runs between spaces, with
 * the punctuation that touches them taken off for reading (the text itself is kept as pasted).
 */
const SENTENCE_END = /(?<=[.؟!؛۔])\s+/u;
const PUNCT = /^[\s«»"'“”‘’()[\]{}،,.؛;:؟?!…\-–—]+|[\s«»"'“”‘’()[\]{}،,.؛;:؟?!…\-–—]+$/gu;
export const PASSAGE_TARGET = 600;

export function passages(text: string): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const p = para.replace(/\s*\n\s*/g, " ").trim();
    if (!p) continue;
    if (p.length <= PASSAGE_TARGET) {
      out.push(p);
      continue;
    }
    let cur = "";
    for (const s of p.split(SENTENCE_END)) {
      if (cur && cur.length + s.length + 1 > PASSAGE_TARGET) {
        out.push(cur);
        cur = s;
      } else cur = cur ? `${cur} ${s}` : s;
    }
    if (cur) out.push(cur);
  }
  return out;
}

/** The words of a passage as they are read: punctuation at their edges taken off, empty ones dropped. */
export function words(passage: string): { surface: string; word: string }[] {
  return passage
    .split(/\s+/)
    .map((surface) => ({ surface, word: surface.replace(PUNCT, "") }))
    .filter((w) => /[ء-يٱ]/.test(w.word));
}

/** True when the text carries harakāt (LIB-24). */
export const hasTashkil = (text: string) => /[ً-ْ]/.test(text);
