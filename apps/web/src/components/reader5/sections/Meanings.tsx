"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Term } from "@/components/terms/Term";
import { formatNumber } from "@/lib/format";
import { useReader } from "@/lib/reader/store";
import type { Features, Label, Mufradat, WordPayload } from "@/lib/reader/types";
import { FORM_TERM, TAG_TERM } from "@/lib/terms";
import { WujuhBlock } from "./Wujuh";

/**
 * Meanings (design 03 §3.5.1, P2.5). Numbered sense lists are assembled by the editorial board from the
 * sources (P3.0/P3.1, law L2: nothing generated). Until a word has them, the section shows what each
 * source says about it — every line attributed — and says plainly that the list is not yet assembled.
 */
export function MeaningsSection({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const setSuggest = useReader((s) => s.setSuggest);
  const lines: { key: string; text: ReactNode; source: ReactNode; lang: string }[] = [];
  // the meaning of this very place first: al-Muyassar fī Gharīb, phrase by phrase (P3.1)
  for (const m of w.occurrence?.meanings_here ?? []) {
    lines.push({
      key: `m${m.id}`,
      text: (
        <>
          <span className="text-word">{m.phrase_ar}</span>: {m.meaning_ar}
        </>
      ),
      source: (
        <>
          {t("meaningHere")} — {locale === "ar" ? m.title_ar : m.title_en}
          {m.mushaf_page ? ` · ${t("mushafPage", { n: formatNumber(m.mushaf_page, locale) })}` : ""}
          {m.match_confidence === "medium" ? ` · ${t("placementInferred")}` : ""}
          {m.display_only ? ` · ${t("displayOnly")}` : ""}
        </>
      ),
      lang: "ar",
    });
  }
  for (const g of w.occurrence?.glosses ?? []) {
    lines.push({
      key: `g${g.id}`,
      text: g.gloss,
      source: <>{locale === "ar" ? g.attribution_ar : g.attribution_en}{g.page_ref ? ` · ${g.page_ref}` : ""}</>,
      lang: "ar",
    });
  }
  if (w.core_meaning) {
    lines.push({
      key: "core",
      text: w.core_meaning.text,
      source: (
        <>
          {t("coreMeaningOf", { root: w.root?.ar_spaced ?? "" })} — {w.core_meaning.author_ar}، {w.core_meaning.title_ar}
          {w.core_meaning.page_ref ? ` · ${w.core_meaning.page_ref}` : ""}
        </>
      ),
      lang: "ar",
    });
  }
  if (w.occurrence?.gloss_en) {
    lines.push({ key: "wbw", text: w.occurrence.gloss_en, source: t("corpusGlossCredit"), lang: "en" });
  }
  if (w.gloss_en) {
    lines.push({ key: "lemma", text: w.gloss_en, source: t("lemmaGlossCredit"), lang: "en" });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {w.senses.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {w.senses.map((s) => (
            <li key={s.id} className="sense-row">
              <span className="mono text-[11px] text-t3">{String(s.ordinal).padStart(2, "0")}</span>
              <div className="flex min-w-0 flex-col gap-1">
                {s.text_ar && <p className="text-[15px] leading-[1.8] text-t1" lang="ar" dir="rtl">{s.text_ar}</p>}
                {s.text_en && <p className="text-[13.5px] italic text-t2" lang="en" dir="ltr">{s.text_en}</p>}
                <button type="button" className="suggest-link self-start text-[11.5px] text-t3 underline-offset-2 hover:text-t1 hover:underline" onClick={() => setSuggest({ kind: "edit", slug: w.slug, label: w.ar.full, ordinal: s.ordinal, current: s.text_ar ?? s.text_en ?? "" })}>
                  {t("suggestEdit")}
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {w.senses.length === 0 && (
        <>
          {lines.length > 0 ? (
            <ol className="flex flex-col gap-2">
              {lines.map((l, i) => (
                <li key={l.key} className="sense-row">
                  <span className="mono text-[11px] text-t3">{formatNumber(i + 1, locale).padStart(2, locale === "ar" ? "٠" : "0")}</span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p
                      className={l.lang === "ar" ? "text-[15px] leading-[1.9] text-t1" : "text-[13.5px] italic leading-relaxed text-t2"}
                      lang={l.lang}
                      dir={l.lang === "ar" ? "rtl" : "ltr"}
                    >
                      {l.text}
                    </p>
                    <p className="text-[11px] text-t3">{l.source}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-t3">{t("noSourcedLines")}</p>
          )}
        </>
      )}
      {w.mufradat && <MufradatBlock m={w.mufradat} />}
      <WujuhBlock w={w} />
      {w.senses.length === 0 && (
        <p className="rounded-lg border border-dashed border-line-2 px-3 py-2 text-[12px] leading-relaxed text-t3">{t("sensesPending")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn text-[12px]" onClick={() => setSuggest({ kind: "sense", slug: w.slug, label: w.ar.full, current: "" })}>
          + {t("proposeSense")}
        </button>
        <button type="button" className="btn text-[12px]" onClick={() => setSuggest({ kind: "error", slug: w.slug, label: w.ar.full, current: `${w.ar.full} — ${w.gloss_en ?? ""}` })}>
          {t("reportError")}
        </button>
      </div>
      {w.occurrence && <GrammarHere features={w.occurrence.features} surface={w.occurrence.surface.full} verseKey={w.occurrence.verse_key} />}
    </div>
  );
}

function lab(l: Label | undefined, locale: string): string | null {
  return l ? (locale === "ar" ? l.ar : l.en) : null;
}

function termed(l: Label | undefined, locale: string): ReactNode {
  const text = lab(l, locale);
  if (!text || !l) return null;
  const id = TAG_TERM[l.tag];
  return id ? <Term id={id}>{text}</Term> : text;
}

/** "Grammar here" (RDR-220, RDR-551): this occurrence's morphology from the corpus, in Arabic labels. */
export function GrammarHere({ features: f, surface, verseKey }: { features: Features; surface: string; verseKey: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const rows: [string, ReactNode][] = [];
  const add = (k: string, v: ReactNode) => v && rows.push([k, v]);
  add(t("gPos"), termed(f.pos, locale));
  if (f.verb_form) {
    const id = FORM_TERM[f.verb_form.number];
    const label = `${f.verb_form.pattern} (${f.verb_form.roman})`;
    add(t("gForm"), id ? <Term id={id}>{label}</Term> : label);
  }
  add(t("gAspect"), termed(f.aspect, locale));
  add(t("gVoice"), termed(f.voice, locale));
  add(t("gDerivation"), termed(f.derivation, locale));
  const pgn = [lab(f.person, locale), lab(f.gender, locale), lab(f.number, locale)].filter(Boolean).join(" · ");
  add(t("gPgn"), pgn || null);
  add(t("gCase"), termed(f.case, locale));
  add(t("gMood"), termed(f.mood, locale));
  if (f.special) add(t("gGroup"), lab(f.special, locale));
  return (
    <div className="flex flex-col gap-1.5">
      <p className="label-caps">{t("grammarHere")}</p>
      <div className="rounded-[10px] border border-line bg-card p-3">
        <p className="quran text-[22px] leading-[1.7]" lang="ar" dir="rtl">{surface}</p>
        <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-t3">{k}</dt>
              <dd className="text-t1">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 text-[11px] text-t3">{t("grammarAt", { ref: verseKey })}</p>
      </div>
    </div>
  );
}

/**
 * al-Rāghib on this word (P3.1): each passage of al-Mufradāt that treats it, verbatim with its page; where he
 * numbers the senses, the numbered list as he gives it. Cut and matched mechanically — said so (L3).
 */
function MufradatBlock({ m }: { m: Mufradat }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const work = locale === "ar" ? `${m.work.author_ar}، ${m.work.title_ar}` : `${m.work.author_en}, ${m.work.title_en}`;
  return (
    <section className="mufradat" aria-label={t("mufradatTitle")}>
      <p className="label-caps">{t("mufradatTitle")}</p>
      {m.subentries.map((s) => (
        <article key={s.id} className="mufradat-sub">
          <p className="ar-classical text-[17px] text-root" lang="ar" dir="rtl">{s.headword_ar}</p>
          {s.senses.length > 0 ? (
            // al-Rāghib often divides a sense again («فالأول… والثاني…»): each numbered list is its own group
            [...new Set(s.senses.map((x) => x.list_no))].map((no, i) => (
              <ol key={no} className={"flex flex-col gap-1.5" + (i > 0 ? " mufradat-sublist" : "")}>
                {s.senses
                  .filter((x) => x.list_no === no)
                  .map((x) => (
                    <li key={`${x.list_no}-${x.sense_index}`} className="flex gap-2" lang="ar" dir="rtl">
                      <span className="mono shrink-0 text-[11px] text-t3">{formatNumber(x.sense_index, locale)}</span>
                      <p className="text-[14.5px] leading-[1.9] text-t1">{x.text_ar}</p>
                    </li>
                  ))}
              </ol>
            ))
          ) : (
            <>
              <p className={"mufradat-text text-[14.5px] leading-[1.9] text-t1" + (open[s.id] ? "" : " is-clamped")} lang="ar" dir="rtl">{s.text_ar}</p>
              {s.text_ar.length > 320 && (
                <button type="button" className="self-start text-[12px] text-t2 underline-offset-2 hover:underline" aria-expanded={!!open[s.id]} onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}>
                  {open[s.id] ? t("showLess") : t("readWholePassage")}
                </button>
              )}
            </>
          )}
          <p className="text-[11px] text-t3">
            {work}
            {s.page_ref ? ` · ${s.page_ref}` : ""}
            {s.senses.length > 0 ? ` · ${t("sensesAsNumbered")}` : ""}
            {s.match_confidence === "medium" ? ` · ${t("matchedMedium")}` : ""}
          </p>
        </article>
      ))}
      <p className="text-[11px] text-t3">{t("mufradatStatus")}</p>
    </section>
  );
}

