"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Term } from "@/components/terms/Term";
import { cnt, formatNumber } from "@/lib/format";
import { type Proposal, type SuggestField, type SuggestTarget, usePersonal, useReader } from "@/lib/reader/store";
import { showHemistichs } from "@/lib/openiti";
import { getJSON } from "@/lib/reader/api";
import type { Features, Label, Mufradat, ParticleEntry, ParticleLink, WordPayload } from "@/lib/reader/types";
import { FORM_TERM, TAG_TERM } from "@/lib/terms";
import { CreditLine } from "../CreditLine";
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
  const proposals = usePersonal((s) => s.proposals);
  const mine = proposals.filter((p) => p.slug === w.slug);
  const lines: { key: string; text: ReactNode; source: ReactNode; lang: string; suggest?: SuggestTarget }[] = [];
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
    // a gloss is open to proposals, for this place or for the lemma (RDR-567)
    const at = w.occurrence.location;
    lines.push({ key: "wbw", text: w.occurrence.gloss_en, source: t.rich("corpusGlossCredit", { term: (c) => <Term id="corpus">{c}</Term> }), lang: "en", suggest: { kind: "gloss", slug: w.slug, label: w.occurrence.surface.full, at, current: w.occurrence.gloss_en } });
  }
  if (w.gloss_en) {
    lines.push({ key: "lemma", text: w.gloss_en, source: t("lemmaGlossCredit"), lang: "en", suggest: { kind: "gloss", slug: w.slug, label: w.ar.full, current: w.gloss_en } });
  }

  const proposalTitle = (p: Proposal) => {
    switch (p.kind) {
      case "edit":
        return t("proposalEdit", { n: formatNumber(p.ordinal ?? 0, locale) });
      case "sense":
        return t("proposalSense");
      case "gloss":
        return t("proposalGloss");
      case "morphology":
        return t("proposalMorph", { field: p.field ? t(p.field) : "" });
      default:
        return t("proposalError");
    }
  };

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
                    {l.suggest && (
                      <button type="button" className="suggest-link self-start text-[11.5px] text-t3 underline-offset-2 hover:text-t1 hover:underline" onClick={() => setSuggest(l.suggest!)}>
                        {t("suggestGloss")}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[13px] text-t3">{t("noSourcedLines")}</p>
          )}
        </>
      )}
      {mine.length > 0 && (
        // what the reader proposed for this word, until the review queue (P7) takes it (RDR-322)
        <section className="proposals-mine" aria-label={t("proposalsMine")}>
          <p className="label-caps">{t("proposalsMine")}</p>
          {mine.map((p) => (
            <div key={p.id} className="proposal-row">
              <p className="text-[12px] font-medium text-t2">
                {proposalTitle(p)}
                {p.at ? ` · ${p.at}` : ""}
              </p>
              <p className="text-[14px] leading-[1.8] text-t1" dir="auto">{p.text}</p>
              <p className="text-[11px] text-amber">{t("proposalPending", { date: new Date(p.ts).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long" }) })}</p>
            </div>
          ))}
        </section>
      )}
      {w.particles.length > 0 && <ParticlesBlock items={w.particles} />}
      {w.mufradat && <MufradatBlock m={w.mufradat} />}
      <WujuhBlock w={w} />
      {w.senses.length === 0 && (
        <p className="rounded-lg border border-dashed border-line-2 px-3 py-2 text-[12px] leading-relaxed text-t3">{t.rich("sensesPending", { term: (c) => <Term id="sense">{c}</Term> })}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn text-[12px]" onClick={() => setSuggest({ kind: "sense", slug: w.slug, label: w.ar.full, current: "" })}>
          + {t("proposeSense")}
        </button>
        <button type="button" className="btn text-[12px]" onClick={() => setSuggest({ kind: "error", slug: w.slug, label: w.ar.full, current: `${w.ar.full} — ${w.gloss_en ?? ""}` })}>
          {t("reportError")}
        </button>
      </div>
      {w.occurrence ? (
        <GrammarHere
          features={w.occurrence.features}
          surface={w.occurrence.surface.full}
          verseKey={w.occurrence.verse_key}
          onSuggest={(fields) =>
            setSuggest({
              kind: "morphology",
              slug: w.slug,
              label: w.occurrence!.surface.full,
              at: w.occurrence!.location,
              current: "",
              fields: [{ key: "gRoot", value: w.root?.ar_spaced ?? t("noRoot") }, { key: "gLemma", value: w.ar.full }, ...fields],
            })
          }
        />
      ) : (
        <p className="rounded-lg border border-dashed border-line-2 px-3 py-2 text-[12px] text-t3">{t("grammarNoPlace")}</p>
      )}
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

/**
 * "Grammar here" (RDR-220, RDR-551): this occurrence's morphology from the corpus, in Arabic labels; each
 * tag, with the root and the lemma, open to a correction that goes to review (RDR-567).
 */
export function GrammarHere({ features: f, surface, verseKey, onSuggest }: { features: Features; surface: string; verseKey: string; onSuggest?: (fields: SuggestField[]) => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const rows: [SuggestField["key"], ReactNode, string][] = [];
  const add = (k: SuggestField["key"], v: ReactNode, text: string | null) => v && text && rows.push([k, v, text]);
  add("gPos", termed(f.pos, locale), lab(f.pos, locale));
  if (f.verb_form) {
    const id = FORM_TERM[f.verb_form.number];
    const label = `${f.verb_form.pattern} (${f.verb_form.roman})`;
    add("gForm", id ? <Term id={id}>{label}</Term> : label, label);
  }
  add("gAspect", termed(f.aspect, locale), lab(f.aspect, locale));
  add("gVoice", termed(f.voice, locale), lab(f.voice, locale));
  add("gDerivation", termed(f.derivation, locale), lab(f.derivation, locale));
  const pgn = [lab(f.person, locale), lab(f.gender, locale), lab(f.number, locale)].filter(Boolean).join(" · ");
  add("gPgn", pgn || null, pgn || null);
  add("gCase", termed(f.case, locale), lab(f.case, locale));
  add("gMood", termed(f.mood, locale), lab(f.mood, locale));
  if (f.special) add("gGroup", lab(f.special, locale), lab(f.special, locale));
  return (
    <div className="flex flex-col gap-1.5">
      <p className="label-caps">{t("grammarHere")}</p>
      <div className="rounded-[10px] border border-line bg-card p-3">
        <p className="quran text-[22px] leading-[1.7]" lang="ar" dir="rtl">{surface}</p>
        <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-t3">{t(k)}</dt>
              <dd className="text-t1">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3">
          <p className="text-[11px] text-t3">{t("grammarAt", { ref: verseKey })}</p>
          {onSuggest && (
            <button type="button" className="suggest-link text-[11.5px] text-t3 underline-offset-2 hover:text-t1 hover:underline" onClick={() => onSuggest(rows.map(([key, , value]) => ({ key, value })))}>
              {t("suggestMorph")}
            </button>
          )}
        </div>
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

/**
 * What the grammarians say about this particle (P3.8): Ibn Hishām's Mughnī and al-Murādī's al-Janā al-Dānī,
 * reached by the word itself or by one of its affixes (the و of «وَإِذْ»). Each entry opens to its senses in
 * the author's order and numbering, verbatim; particles never get a root (L2).
 */
function ParticlesBlock({ items }: { items: ParticleLink[] }) {
  const t = useTranslations("rd");
  return (
    <section className="particles" aria-label={t("particlesTitle")}>
      <p className="label-caps">{t("particlesTitle")}</p>
      <ul className="flex flex-col">
        {items.map((p) => (
          <ParticleItem key={p.id} p={p} />
        ))}
      </ul>
      <p className="text-[11px] text-t3">{t("particlesStatus")}</p>
    </section>
  );
}

function ParticleItem({ p }: { p: ParticleLink }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["particle", p.id], queryFn: () => getJSON<ParticleEntry>(`/particles/${p.id}`), enabled: open, staleTime: Infinity });
  const author = (locale === "ar" ? p.author_ar : p.author_en).split(/[،,]/)[0];
  return (
    <li className="particle-item">
      <button type="button" className="particle-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="ar-classical text-[19px] text-t1" lang="ar">{p.headword_ar}</span>
        {p.via.kind === "affix" && (
          <span className="text-[11.5px] text-t3">{t("particleViaAffix", { text: p.via.text, label: locale === "ar" ? p.via.label.ar : p.via.label.en })}</span>
        )}
        <span className="flex-1" />
        <span className="text-[11.5px] text-t3">{`${author} · ${locale === "ar" ? p.title_ar : p.title_en}`}</span>
        <span className="mono text-[11px] text-t3">{t("particleSenses", cnt(p.sense_count, locale))}</span>
      </button>
      {open && (q.isLoading ? <div className="h-16 animate-pulse rounded-lg bg-card-2" /> : q.data ? <ParticleSenses e={q.data} /> : null)}
    </li>
  );
}

function ParticleSenses({ e }: { e: ParticleEntry }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [wide, setWide] = useState<Record<string, boolean>>({});
  const page = (vol: number | null, pg: number | null) => (pg == null ? "" : vol && vol > 1 ? `${formatNumber(vol, locale)}/${formatNumber(pg, locale)}` : formatNumber(pg, locale));
  return (
    <div className="particle-body">
      {e.senses.map((s) => (
        <div
          key={s.id}
          className={"particle-sense is-" + s.kind}
          style={s.list_depth && s.list_depth > 1 ? { marginInlineStart: (s.list_depth - 1) * 14 } : undefined}
          lang="ar"
          dir="rtl"
        >
          {s.kind === "sense" && <span className="mono shrink-0 text-[11px] text-t3">{s.marker_ar ?? formatNumber(s.sense_index ?? 0, locale)}</span>}
          <div className="min-w-0 flex-1">
            <p className={"text-[14.5px] leading-[1.9]" + (s.kind === "note" ? " text-t3" : " text-t1") + (wide[s.id] ? "" : " is-clamped")}>{showHemistichs(s.text_ar)}</p>
            {s.text_ar.length > 260 && (
              <button type="button" className="text-[11.5px] text-t2 underline-offset-2 hover:underline" aria-expanded={!!wide[s.id]} onClick={() => setWide((w) => ({ ...w, [s.id]: !w[s.id] }))}>
                {wide[s.id] ? t("showLess") : t("readWholePassage")}
              </button>
            )}
          </div>
          {s.page != null && <span className="mono shrink-0 text-[10.5px] text-t3">{page(s.page_vol, s.page)}</span>}
        </div>
      ))}
      <ul>
        <CreditLine s={e.source} />
      </ul>
    </div>
  );
}

