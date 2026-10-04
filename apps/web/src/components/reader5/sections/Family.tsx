"use client";

import { useLocale, useTranslations } from "next-intl";
import { Term } from "@/components/terms/Term";
import { TermText } from "@/components/terms/TermText";
import { cnt, cnt2, formatNumber } from "@/lib/format";
import { sourceLine } from "@/lib/reader/board";
import { useReader } from "@/lib/reader/store";
import type { LemmaLite, PatternInfo, WordPayload } from "@/lib/reader/types";
import { FORM_TERM } from "@/lib/terms";

/** «ما في كتب الصرف»: the pattern's view, where the sarf books' own words on it are quoted (P3.3) — shown only when
 * they say something on it. */
export function ClassicalLink({ p }: { p: PatternInfo }) {
  const t = useTranslations("rd");
  const openShapes = useReader((s) => s.openShapes);
  if (!p.classical) return null;
  return (
    <button
      type="button"
      className="classical-link text-[11px] text-t3 underline-offset-2 hover:text-t1 hover:underline"
      onClick={() => openShapes(p.slug)}
      title={t("classicalLinkTitle", { p: p.ar.full })}
    >
      {t("classicalLink")}
    </button>
  );
}

/** What a pattern does, from the editorial catalogue (P3.3) when written, else its verb form's term. */
export function PatternFunction({ p }: { p: PatternInfo }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const fn = locale === "ar" ? p.function_ar : p.function_en;
  if (fn) return <span><TermText text={fn} /></span>;
  const id = p.form_number ? FORM_TERM[p.form_number] : null;
  if (id) return <Term id={id}>{t("formN", { n: formatNumber(p.form_number!, locale) })}</Term>;
  return <span className="text-t3">{t("patternFunctionPending")}</span>;
}

export function WordChip({ m, current }: { m: LemmaLite; current?: boolean }) {
  const t = useTranslations("rd");
  const openWord = useReader((s) => s.openWord);
  const locale = useLocale();
  return (
    <button
      type="button"
      className={"word-chip" + (current ? " is-current" : "")}
      aria-current={current || undefined}
      onClick={() => openWord({ slug: m.slug, at: null })}
      title={`${m.ar.translit}${m.gloss_en ? ` — ${m.gloss_en}` : ""}`}
    >
      <span className="ar-classical text-[19px] leading-[1.6]" lang="ar" dir="rtl">{m.ar.full}</span>
      <span className="mono text-[10.5px] text-t3">{formatNumber(m.occurrences, locale)}</span>
      {/* said to be non-Arabic: shared letters need not mean a shared meaning (P3.7a) */}
      {m.loanword && <span className="loan-mark" title={t("loanMarkTitle")}>{t("loanMark")}</span>}
    </button>
  );
}

/** "Graph the root": the whole family handed to the editor as a root seed (RDR-221, 222). */
function GraphRootButton({ root }: { root: string }) {
  const t = useTranslations("rd");
  const setHandoff = useReader((s) => s.setHandoff);
  return (
    <button type="button" className="btn text-[12px]" onClick={() => setHandoff({ seed: "root", root })}>
      {t("graphRoot")}
    </button>
  );
}

/** Word family (design 03 §3.5.2, RDR-221…225): every lemma on the root, grouped by pattern. */
export function FamilySection({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const tb = useTranslations("board");
  const locale = useLocale();
  if (!w.root) return <p className="text-[13px] text-t3">{t("noRootFamily")}</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[10px] border border-line bg-card p-3">
        <div className="flex items-baseline gap-2">
          <span className="ar-classical text-[30px] tracking-[.08em] text-root" lang="ar">{w.root.ar_spaced}</span>
          <span className="mono text-[11.5px] text-t3" dir="ltr">{w.root.translit}</span>
          <span className="flex-1" />
          <GraphRootButton root={w.root.key} />
        </div>
        {w.root.gloss_en && (
          <div className="mt-0.5">
            <p className="text-[13px] text-t1" dir="ltr" lang="en">{w.root.gloss_en}</p>
            {/* the credit in the reader's language, on its own line so neither direction breaks the other */}
            <p className="text-[11px] text-t3">
              {tb("gloss")}
              {w.root.gloss_board?.sources.length ? tb("from", { works: sourceLine(w.root.gloss_board.sources, locale) }) : ""}
            </p>
          </div>
        )}
        {w.core_meaning && (
          <p className="mt-1 text-[13.5px] leading-[1.9] text-t2" lang="ar" dir="rtl">
            {/* the board's correction of where Ibn Fāris's statement was cut, when it made one */}
            {w.root.gist_board?.kept === "corrected" && w.root.gist_ar ? w.root.gist_ar : w.core_meaning.text}
            <span className="block text-[11px] text-t3">— {w.core_meaning.author_ar}، {w.core_meaning.title_ar}</span>
            {w.root.gist_board && <span className="block text-[11px] text-t3">{tb(w.root.gist_board.kept === "corrected" ? "coreCorrected" : "coreKept")}</span>}
          </p>
        )}
        {(w.root.gist_source?.usul === "several" || w.root.gist_source?.usul === "unrelated") && (
          // the family is the words that share these letters, not one meaning (P3.7a)
          <p className="usul-note mt-1.5 rounded-md bg-card-2 px-2.5 py-1.5 text-[12px] leading-relaxed text-t2" data-usul={w.root.gist_source.usul}>
            {t(w.root.gist_source.usul === "unrelated" ? "usulUnrelated" : "usulSeveral")}
          </p>
        )}
        <p className="mt-1 text-[12px] text-t3">
          {t("rootCounts", { ...cnt(w.root.occurrences, locale), ...cnt2(w.root.lemma_count, locale) })}
        </p>
      </div>
      <p className="label-caps">{t("patternsOnRoot")}</p>
      {w.family.map((g, i) => (
        <div key={g.pattern?.slug ?? `none-${i}`} className="family-group overflow-hidden rounded-[10px] border border-line">
          <div className="flex items-center gap-2 bg-card-2 px-3 py-1.5">
            {g.pattern ? (
              <>
                <span className="ar-classical text-[19px] text-form" lang="ar">{g.pattern.ar.full}</span>
                <span className="mono text-[11px] text-t3" dir="ltr">{g.pattern.ar.translit}</span>
                <span className="flex-1" />
                <span className="text-[11.5px]"><PatternFunction p={g.pattern} /></span>
                <ClassicalLink p={g.pattern} />
              </>
            ) : (
              <span className="text-[12px] text-t3"><Term id="wazn">{t("noPatternGroup")}</Term></span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 p-2">
            {g.members.map((m) => (
              <WordChip key={m.slug} m={m} current={m.slug === w.slug} />
            ))}
          </div>
        </div>
      ))}
      {w.shapes.same_pattern_other_roots.length > 0 && w.pattern && (
        <>
          <p className="label-caps">{t("samePatternOtherRoots")}</p>
          <p className="text-[12px] text-t3">{t("samePatternNote", { p: w.pattern.ar.translit })}</p>
          <div className="flex flex-wrap gap-1.5">
            {w.shapes.same_pattern_other_roots.map((m) => (
              <WordChip key={m.slug} m={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
