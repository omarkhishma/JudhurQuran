import { getTranslations } from "next-intl/server";
import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import { formatNumber, verseRef } from "@/lib/format";
import type { Verse } from "@/lib/types";
import { PAGES } from "./pageCount";
import { PageTurn } from "./PageTurn";
import { VerseLines } from "./VerseLines";

const PRIMARY = ["audio", "roots"] as const;

export type PageSurah = { number: number; name_ar: string; name_translit: string; verse_count: number };

/**
 * A page of the Madinah mushaf (B1, page mode): the verses that stand on it — every page of this mushaf opens and closes
 * on a verse's end, so none is cut — each sūra that begins on it headed and opened with the basmala as the mushaf does,
 * every word the reader's own control (the panel, the hover card, the verse's tools); the way to the page before and
 * after, by the arrows on a keyboard and a swipe on a phone. The lines of the printed page are not drawn: where each
 * line breaks inside a verse is data the project does not hold (B1, the owner's).
 */
export async function PageText({ page, verses, surahs, basmala, locale }: { page: number; verses: Verse[]; surahs: Map<number, PageSurah>; basmala: Verse; locale: string }) {
  const t = await getTranslations("rd");
  const juz = verses[0]?.juz;
  const nav = (where: "top" | "bottom") => (
    // the previous page first and the next last: in Arabic the next page lies to the left, as a mushaf's does
    <nav className="page-turns" aria-label={t(where === "top" ? "pageTurnsTop" : "pageTurnsBottom")}>
      {page > 1 ? (
        <Link href={`/mushaf/${page - 1}`} className="btn" rel="prev" prefetch={false}>{t("prevPage")}</Link>
      ) : (
        <span />
      )}
      <span className="mono text-[12px] text-t3">{t("pageOf", { n: formatNumber(page, locale), of: formatNumber(PAGES, locale) })}</span>
      {page < PAGES ? (
        <Link href={`/mushaf/${page + 1}`} className="btn" rel="next" prefetch={false}>{t("nextPage")}</Link>
      ) : (
        <span />
      )}
    </nav>
  );
  return (
    <div className="paper mushaf-page" data-page-mode={page}>
      <PageTurn page={page} />
      <header className="chapter-head">
        <h1 className="chapter-title ar-classical" lang="ar">{t("mushafPageTitle", { n: formatNumber(page, locale) })}</h1>
        <p className="text-[12px] text-t3">
          {[juz ? t("juzN", { n: formatNumber(juz, locale) }) : null, ...[...new Set(verses.map((v) => v.surah))].map((s) => `سورة ${surahs.get(s)?.name_ar ?? s}`)].filter(Boolean).join(" • ")}
        </p>
        <p className="text-[11.5px] text-t3">{t("pageModeNote")}</p>
        {nav("top")}
      </header>
      <div className="passages">
        {verses.map((v) => {
          const s = surahs.get(v.surah);
          return (
            <Fragment key={v.key}>
              {v.ayah === 1 && s && (
                <header className="page-surah-head">
                  <h2 className="chapter-title ar-classical" lang="ar">
                    <Link href={`/quran/${s.number}`}>{`سورة ${s.name_ar}`}</Link>
                  </h2>
                  {s.number !== 1 && s.number !== 9 && (
                    <p className="quran basmala" dir="rtl" lang="ar" aria-label={t("basmala")}>
                      {basmala.tokens.map((tk) => tk.text).join(" ")}
                    </p>
                  )}
                </header>
              )}
              <article id={`v${v.surah}-${v.ayah}`} data-verse={v.key} data-page={v.page} className="passage" aria-label={t("verseLabel", { ref: verseRef(v.key, locale) })}>
                <div className="passage-label">
                  <span className="mono" dir="ltr">{verseRef(v.key, locale)}</span>
                  <span className="passage-rule" aria-hidden="true" />
                </div>
                <div className="passage-tools" role="toolbar" aria-label={t("verseTools", { ref: verseRef(v.key, locale) })}>
                  {PRIMARY.map((tool) => (
                    <button key={tool} className="ptool" data-tool={tool} data-verse-key={v.key} aria-pressed={false} title={t(`tool_${tool}_hint`)}>
                      {t(`tool_${tool}`)}
                      {tool === "roots" && <span className="ptool-badge mono">{formatNumber(new Set(v.words.map((w) => w.root).filter(Boolean)).size, locale)}</span>}
                    </button>
                  ))}
                  <span className="ptool-more" data-more={v.key} />
                </div>
                <VerseLines v={v} sajdaLabel={t("sajdaMark")} />
                <div className="gram-band" data-band={v.key} />
                <div data-inline={v.key} />
                <div data-gloss={v.key} />
                <div data-note={v.key} />
                <div data-drawer={v.key} />
              </article>
            </Fragment>
          );
        })}
      </div>
      <footer className="chapter-foot">{nav("bottom")}</footer>
    </div>
  );
}
