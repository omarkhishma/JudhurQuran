import { SAJDA, splitFurniture } from "@/lib/reader/verseText";
import type { Verse } from "@/lib/types";

/** One verse as the mushaf writes it. Each display token is a button (keyboard-reachable, RDR-466)
 * carrying the corpus word(s) it holds, their lemma slugs and the root; the ayah-end medallion is drawn
 * by the Quran font from the verse number. Furniture is not interactive (RDR-547): the ḥizb sign and the
 * sajda sign stand outside the buttons; waqf signs are marks the text writes on a word's last letter, so
 * they stay on it — a word is never a sign alone. */
export function VerseLines({ v, sajdaLabel }: { v: Verse; sajdaLabel: string }) {
  const byPos = new Map(v.words.map((w) => [w.position, w]));
  return (
    <p className="quran verse-line" dir="rtl" lang="ar">
      {v.hizb_mark && (
        <span className="hizb-mark" aria-hidden="true">
          {"۞ "}
        </span>
      )}
      {v.tokens.map((tk, i) => {
        const first = byPos.get(tk.word_from);
        const second = tk.word_to !== tk.word_from ? byPos.get(tk.word_to) : undefined;
        const { word, sajda } = splitFurniture(tk.text);
        return (
          <span key={tk.position}>
            <button
              className="w"
              data-t={tk.position}
              data-w={`${v.surah}:${v.ayah}:${tk.word_from}`}
              data-w2={second ? `${v.surah}:${v.ayah}:${tk.word_to}` : undefined}
              data-l={first?.lemma_slug ?? undefined}
              data-l2={second?.lemma_slug ?? undefined}
              data-r={first?.root ?? undefined}
            >
              {word}
            </button>
            {sajda && (
              <span className="sajda-mark" data-furniture="sajda" role="img" aria-label={sajdaLabel} title={sajdaLabel}>
                {SAJDA}
              </span>
            )}
            {i < v.tokens.length - 1 ? " " : null}
          </span>
        );
      })}{" "}
      <button className="ayah-num" data-verse-btn={v.key} tabIndex={-1}>
        {v.number_text}
      </button>
    </p>
  );
}
