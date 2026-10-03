import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cnt, formatNumber } from "@/lib/format";
import type { SurahPayload, Verse } from "@/lib/types";
import { VerseLines } from "./VerseLines";

const TOOLS = ["audio", "roots", "tafsir", "related", "copy", "cite", "note", "graph"] as const;
const DRAWERS = new Set<string>(["roots", "related", "note", "graph"]);

/**
 * The reading surface's text, rendered on the server (design 03 §3.4): every word a focusable control
 * carrying its corpus location, lemma slug and root (RDR-466); passage furniture that is not
 * interactive; per-verse tools revealed on hover, on focus, or by a 420 ms long-press on touch.
 * ReadingSurface wires all of it by event delegation, so al-Baqara's 6,000+ words stay light.
 */
export async function SurahText({ payload, basmala, locale }: { payload: SurahPayload; basmala: Verse; locale: string }) {
  const t = await getTranslations("rd");
  const tc = await getTranslations("common");
  const s = payload.surah;
  const showBasmala = s.number !== 1 && s.number !== 9;
  return (
    <div className="paper">
      <header className="chapter-head">
        <p className="mono text-[11.5px] uppercase text-t3" dir="ltr">{`${formatNumber(s.number, locale)} / ${formatNumber(114, locale)}`}</p>
        <h1 className="chapter-title ar-classical" lang="ar">{`سورة ${s.name_ar}`}</h1>
        {locale === "en" && <p className="text-[14px] text-t2">{`${s.name_translit} — ${s.name_en}`}</p>}
        <button type="button" className="about-btn" data-about>
          {t("aboutSurah")}
        </button>
        <p className="text-[12px] text-t3">
          {(s.revelation_place === "meccan" ? t("meccan") : t("medinan")) + " · " + tc("verses", cnt(s.verse_count, locale)) + " · " + t("pagesRange", { from: formatNumber(s.page_start, locale), to: formatNumber(s.page_end, locale) })}
        </p>
        {showBasmala && (
          <p className="quran basmala" dir="rtl" lang="ar" aria-label={t("basmala")}>
            {basmala.tokens.map((tk) => tk.text).join(" ")}
          </p>
        )}
      </header>
      <div className="passages">
        {payload.verses.map((v) => (
          <article key={v.key} id={`v${v.ayah}`} data-verse={v.key} className="passage" aria-label={t("verseLabel", { ref: v.key })}>
            <div className="passage-label">
              <span className="mono" dir="ltr">{v.key}</span>
              <span className="passage-rule" aria-hidden="true" />
            </div>
            <div className="passage-tools" data-tools role="toolbar" aria-label={t("verseTools", { ref: v.key })}>
              {TOOLS.map((tool) => (
                <button key={tool} type="button" className="ptool" data-tool={tool} data-verse-key={v.key} aria-pressed={DRAWERS.has(tool) ? false : undefined} title={t(`tool_${tool}_hint`)}>
                  {t(`tool_${tool}`)}
                </button>
              ))}
            </div>
            <VerseLines v={v} />
            <div className="gram-band" data-band={v.key} />
            <p className="verse-imlaei" dir="rtl" lang="ar">
              <span className="verse-imlaei-label">{t("imlaeiLabel")}</span> {v.text_imlaei}
            </p>
            <p className="verse-translit" data-translit dir="ltr" lang="en">
              {v.words.map((w) => w.translit ?? "").join(" ")}
            </p>
            <div data-inline={v.key} />
            <div data-gloss={v.key} />
            <div data-note={v.key} />
            <div data-drawer={v.key} />
          </article>
        ))}
      </div>
      <footer className="chapter-foot">
        <p className="text-[11.5px] text-t3">{t("endOfSurah", { name: s.name_ar })}</p>
        <nav className="flex w-full justify-between gap-3" aria-label={t("surahNav")}>
          {s.number > 1 ? <Link href={`/quran/${s.number - 1}`} className="btn min-h-[40px]">{t("prevSurah")}</Link> : <span />}
          {s.number < 114 ? <Link href={`/quran/${s.number + 1}`} className="btn min-h-[40px]">{t("nextSurah")}</Link> : <span />}
        </nav>
      </footer>
    </div>
  );
}
