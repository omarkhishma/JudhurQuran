import type { Verse } from "@/lib/types";
import { InlineLayer } from "./InlineLayer";

/**
 * Server-rendered Quran text. Every display token is a span carrying the corpus word it belongs to
 * (data-w, and data-w2 when one mushaf word holds two corpus words) and its root (data-r). Clicks are
 * handled by ReaderController through event delegation — no per-word handlers, so even al-Baqarah
 * (6,000+ words) stays light. The verse number is rendered verbatim in the Quran font, which draws the
 * ayah-end medallion, and is the entry point to the verse's tafsir.
 */
export function VerseList({
  verses,
  surahName,
  locale,
  ayahLabel,
  verseActionsLabel,
  translationTitle,
}: {
  verses: Verse[];
  surahName: string;
  locale: string;
  ayahLabel: (n: string) => string;
  verseActionsLabel: (ref: string) => string;
  translationTitle?: string;
}) {
  return (
    <div className="verse-list">
      {verses.map((v) => {
        const byPos = new Map(v.words.map((w) => [w.position, w]));
        return (
          <article key={v.key} id={`v${v.ayah}`} data-verse={v.key} className="verse" aria-label={ayahLabel(v.number_text)}>
            <p className="quran verse-text" dir="rtl" lang="ar">
              {v.hizb_mark && (
                <span className="hizb-mark" aria-hidden="true">
                  {"\u06de\u00a0"}
                </span>
              )}
              {v.tokens.map((tk, i) => {
                const first = byPos.get(tk.word_from);
                const loc = `${v.surah}:${v.ayah}:${tk.word_from}`;
                return (
                  <span key={tk.position}>
                    <span
                      className="w"
                      data-w={loc}
                      data-w2={tk.word_to !== tk.word_from ? `${v.surah}:${v.ayah}:${tk.word_to}` : undefined}
                      data-r={first?.root ?? undefined}
                    >
                      {tk.text}
                    </span>
                    {i < v.tokens.length - 1 ? " " : null}
                  </span>
                );
              })}
              {" "}
              <button
                type="button"
                className="ayah-num"
                data-verse-btn={v.key}
                aria-label={verseActionsLabel(`${surahName} ${v.number_text}`)}
                aria-haspopup="dialog"
              >
                {v.number_text}
              </button>
            </p>
            <InlineLayer verseKey={v.key} ayah={v.ayah} initial={v.translation ?? null} locale={locale} title={translationTitle} />
          </article>
        );
      })}
    </div>
  );
}
