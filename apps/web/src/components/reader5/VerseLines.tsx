import type { Verse } from "@/lib/types";

/** One verse as the mushaf writes it. Each display token is a button (keyboard-reachable, RDR-466)
 * carrying the corpus word(s) it holds, their lemma slugs and the root; the ayah-end medallion is drawn
 * by the Quran font from the verse number. */
export function VerseLines({ v }: { v: Verse }) {
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
        return (
          <span key={tk.position}>
            <button
              type="button"
              className="w"
              data-t={tk.position}
              data-w={`${v.surah}:${v.ayah}:${tk.word_from}`}
              data-w2={second ? `${v.surah}:${v.ayah}:${tk.word_to}` : undefined}
              data-l={first?.lemma_slug ?? undefined}
              data-l2={second?.lemma_slug ?? undefined}
              data-r={first?.root ?? undefined}
              data-pos={first?.pos ?? undefined}
              tabIndex={-1}
            >
              {tk.text}
            </button>
            {i < v.tokens.length - 1 ? " " : null}
          </span>
        );
      })}{" "}
      <button type="button" className="ayah-num" data-verse-btn={v.key} tabIndex={-1}>
        {v.number_text}
      </button>
    </p>
  );
}
