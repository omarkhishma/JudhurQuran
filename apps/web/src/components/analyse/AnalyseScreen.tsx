"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Term } from "@/components/terms/Term";
import { Segmented } from "@/components/ui/Segmented";
import { Link } from "@/i18n/navigation";
import { type Analysis, type AnalysedToken, type Candidate, REVIEW_BELOW, SAMPLE, toConllu } from "@/lib/analyse";
import { cnt, formatNumber, toArabicDigits } from "@/lib/format";
import { encodeSeed, type Seed } from "@/lib/graph/seedCodec";
import { getJSON } from "@/lib/reader/api";
import { useAnalyseChoices } from "@/lib/store/analyseChoices";
import { TAG_TERM } from "@/lib/terms";
import { useDebounced } from "@/lib/useDebounced";

/** Quranic phrases and the design's sample (ANA-03, ANA-Q05); an āya reference loads that āya. */
const TRY = ["وَقُل رَّبِّ زِدۡنِي عِلۡمٗا", "ذَٰلِكَ ٱلۡكِتَٰبُ لَا رَيۡبَۛ فِيهِۛ", "2:255", SAMPLE];
type View = "table" | "interlinear";

/** Confidence always with two decimals (ANA-16): ١٫٠٠، ٠٫٧٠. */
const conf = (x: number, locale: string) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);

const label = (l: unknown, locale: string): string | null => {
  if (!l || typeof l !== "object" || !("ar" in l)) return null;
  const x = l as { ar: string; en: string };
  return locale === "ar" ? x.ar : x.en;
};

/**
 * The Analyser (design 05 §5.4, inventory ANA-01…41 with the Quran notes ANA-Q01…Q07): a phrase word by
 * word. Quranic text — an āya reference or a phrase found in one āya — is read from the corpus, gold at
 * confidence 1.0 with its place; any other text is read against the Quran's own words, every candidate
 * with how it was found and how sure it is; the reader can choose among them. Table and interlinear
 * views, CoNLL-U, and a graph seeded from the phrase.
 */
export function AnalyseScreen({ initialQ, initialView, initial }: { initialQ: string; initialView: View; initial: Analysis | null }) {
  const t = useTranslations("analyse");
  const locale = useLocale();
  const [q, setQ] = useState(initialQ);
  const [view, setView] = useState<View>(initialView);
  const [status, setStatus] = useState<string | null>(null);
  const choices = useAnalyseChoices((s) => s.choices);
  const choose = useAnalyseChoices((s) => s.choose);
  const dq = useDebounced(q.trim(), 250);
  const res = useQuery({
    queryKey: ["analyse", dq],
    queryFn: () => getJSON<Analysis>(`/analyse?q=${encodeURIComponent(dq)}`),
    enabled: !!dq,
    initialData: dq === initialQ.trim() && initial ? initial : undefined,
    staleTime: Infinity,
  });
  const a = dq ? res.data : undefined;

  // the address bar carries the phrase and the view, so a link reopens the same analysis (ANA-31)
  useEffect(() => {
    const u = new URL(window.location.href);
    if (dq) u.searchParams.set("q", dq);
    else u.searchParams.delete("q");
    if (view === "interlinear") u.searchParams.set("view", "interlinear");
    else u.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", u);
  }, [dq, view]);

  const chosen = (tk: AnalysedToken): Candidate | undefined => tk.candidates[choices[tk.key] ?? 0] ?? tk.candidates[0];

  async function copyConllu() {
    if (!a) return;
    try {
      await navigator.clipboard.writeText(toConllu(a, chosen));
      setStatus(t("copied"));
    } catch {
      setStatus(t("copyFailed"));
    }
  }

  const seed: Seed | null = useMemo(() => {
    if (!a) return null;
    if (a.source.kind === "quran" && a.source.whole_verse && a.source.verse_key) {
      const keys = [...new Set(a.tokens.map((tk) => tk.verse_key).filter((k): k is string => !!k))];
      return keys.length === 1 ? { seed: "verse", key: keys[0] } : { seed: "trail", steps: keys.map((id) => ({ kind: "verse" as const, id })) };
    }
    // the reader's own words carry their confidence and their spelling, to be reviewed before they enter a map (F4)
    const own = a.source.kind !== "quran";
    const steps = a.tokens.flatMap((tk) => {
      const c = chosen(tk);
      const id = c?.lemma?.slug;
      if (!id) return [];
      // the confidence the Analyser shows for the token, or the candidate's when the reader chose another
      const conf = choices[tk.key] != null ? c.confidence : tk.confidence;
      return [own && tk.kind !== "gold" ? { kind: "word" as const, id, conf, s: tk.surface.slice(0, 40) } : { kind: "word" as const, id }];
    });
    if (!steps.length) return null;
    // a phrase placed in one verse brings its verse; the reader's own phrase comes as a sentence card (ANA-22)
    if (a.source.kind === "quran" && a.source.verse_key) return { seed: "trail", steps: [{ kind: "verse" as const, id: a.source.verse_key }, ...steps] };
    return { seed: "trail", steps, phrase: a.text.replace(/\s+/g, " ").slice(0, 600) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, choices]);

  const foot = a ? t("foot", { tokens: formatNumber(a.counts.tokens, locale), roots: formatNumber(a.counts.roots, locale), review: formatNumber(a.counts.to_review, locale) }) : "";

  return (
    <div className="analyse-screen">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[22px] font-semibold">{t("title")}</h1>
        <span className="flex-1" />
        <Segmented label={t("viewLabel")} value={view} onChange={setView} options={[{ value: "table", label: t("viewTable") }, { value: "interlinear", label: t("viewInterlinear") }]} />
        <button type="button" className="btn" onClick={() => void copyConllu()} disabled={!a?.tokens.length}>
          {t("copyConllu")}
        </button>
      </div>
      <p className="text-[13px] text-t2">{t("lead")}</p>
      <textarea
        className="analyse-input"
        dir="rtl"
        lang="ar"
        rows={2}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("placeholder")}
        aria-label={t("inputLabel")}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-t3">{t("try")}</span>
        {/* a reference written as the interface writes numbers (the API reads either) */}
        {TRY.map((raw) => locale === "ar" && /^[\d:]+$/.test(raw) ? toArabicDigits(raw) : raw).map((x) => (
          <button key={x} type="button" className="chip" onClick={() => setQ(x)} title={x}>
            <span className="ar-classical text-[15px]" lang="ar" dir="rtl">{x.split(/\s+/).length > 3 ? `${x.split(/\s+/).slice(0, 3).join(" ")}…` : x}</span>
          </button>
        ))}
        <span className="flex-1" />
        {a && <span className="analyse-meta text-[12px] text-t3">{foot}</span>}
      </div>
      {status && (
        <p className="text-[12.5px] text-t2" role="status">
          {status}
        </p>
      )}
      {a?.source.kind === "quran" && a.source.verse_key && (
        <p className="analyse-source text-[12.5px] text-t2">
          {t(!a.source.whole_verse ? "sourcePhrase" : a.source.verse_key.includes("-") ? "sourceRange" : "sourceVerse", { ref: locale === "ar" ? toArabicDigits(a.source.verse_key) : a.source.verse_key })}{" "}
          <Link href={`/quran/${a.source.verse_key.split("-")[0].replace(":", "/")}`} className="underline-offset-2 hover:underline">{t("openInReader")}</Link>
        </p>
      )}
      {a?.truncated && <p className="text-[12px] text-amber">{t("truncated")}</p>}

      {!dq && <p className="text-[13.5px] text-t3">{t("empty")}</p>}
      {dq && res.isLoading && <div className="h-40 animate-pulse rounded-xl bg-card-2" aria-busy="true" aria-label={t("loading")} />}
      {dq && res.isError && (
        <p className="text-[13px] text-bad" role="alert">
          {t("error")}
        </p>
      )}

      {a && a.tokens.length > 0 && view === "table" && (
        <div className="analyse-table" role="table" aria-label={t("tableLabel")}>
          <div className="analyse-row analyse-head" role="row">
            {(["colToken", "colSegments", "colRoot", "colAnalysis", "colConf"] as const).map((c) => (
              <span key={c} role="columnheader" className="label-caps">{t(c)}</span>
            ))}
          </div>
          {a.tokens.map((tk, i) => (
            <TokenRow key={`${i}-${tk.surface}`} tk={tk} pick={choices[tk.key] ?? 0} onPick={(n) => choose(tk.key, n)} />
          ))}
        </div>
      )}

      {a && a.tokens.length > 0 && view === "interlinear" && (
        <ol className="interlinear" dir="rtl" aria-label={t("interlinearLabel")}>
          {a.tokens.map((tk, i) => {
            const c = tk.kind === "particle" ? tk.particle : chosen(tk);
            return (
              <li key={`${i}-${tk.surface}`} className={"interlinear-card" + (tk.kind !== "particle" && tk.confidence < REVIEW_BELOW ? " is-unsure" : "")}>
                <span className={tk.kind === "gold" || a.source.kind === "quran" ? "quran text-[26px] leading-[1.7]" : "ar-classical text-[26px] leading-[1.6]"} lang="ar">{tk.surface}</span>
                {/* the transliteration line where the corpus reads the word (ANA-25) */}
                {c?.translit && (
                  <span className="text-[11.5px] italic text-t3" lang="ar-Latn" dir="ltr">
                    {c.translit}
                  </span>
                )}
                <span className="text-[11.5px] text-t2" lang="en" dir="ltr">{tk.kind === "particle" ? t("particleShort") : (c?.gloss_en ?? "?")}</span>
                {c?.root && tk.kind !== "particle" && <span className="ar-classical text-[14px] text-root" lang="ar">{c.root.spaced}</span>}
                <span className={"mono text-[10.5px] " + (tk.confidence >= REVIEW_BELOW ? "text-good" : "text-amber")}>{conf(tk.confidence, locale)}</span>
              </li>
            );
          })}
        </ol>
      )}

      {a && a.tokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-2 text-[12px] text-t3">
          <span className="flex items-center gap-1.5">
            <span className="seg-chip-sample" aria-hidden="true" /> {t("legendAffix")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="unsure-sample" aria-hidden="true" /> {t("legendUnsure")}
          </span>
          <span>{foot}</span>
          <span className="flex-1" />
          {seed && (
            <Link href={`/graph/seed?s=${encodeSeed(seed)}`} className="btn">
              {t("buildGraph")}
            </Link>
          )}
        </div>
      )}
      <p className="text-[11.5px] leading-relaxed text-t3">{t("method")}</p>
    </div>
  );
}

const BARE = /[\u064b-\u0652\u0670\u06d6-\u06ed]/g;

function Segments({ c, tk }: { c: Candidate | undefined; tk: AnalysedToken }) {
  const t = useTranslations("analyse");
  const locale = useLocale();
  if (tk.kind === "particle") return <span className="seg-chip is-particle" title={t("particleNotSegmented")}><span lang="ar">{tk.surface}</span></span>;
  // a segment must hold a letter: harakat-only pieces are left out (ANA-10)
  const segs = (c?.segments ?? []).filter((s) => /[ء-ي]/.test(s.text));
  if (segs.length) {
    return (
      <span className="flex flex-wrap gap-1" dir="rtl">
        {segs.map((s) => (
          <span key={s.index} className={"seg-chip" + (s.kind === "stem" ? " is-stem" : "")} title={s.kind === "stem" ? (label(s.features?.pos, locale) ?? t("stem")) : (label(s.label, locale) ?? s.kind)}>
            <span className={tk.kind === "gold" ? "quran text-[17px] leading-[1.7]" : "ar-classical text-[17px] leading-[1.6]"} lang="ar">
              {tk.kind === "gold" ? s.text : s.text.replace(BARE, "")}
            </span>
            <span className="text-[10px] text-t3">{s.kind === "stem" ? (label(s.features?.pos, locale) ?? t("stem")) : label(s.label, locale)}</span>
          </span>
        ))}
      </span>
    );
  }
  if (tk.kind === "clitic" && tk.stem) {
    return (
      <span className="flex flex-wrap gap-1" dir="rtl">
        {tk.clitics.filter((x) => tk.key.startsWith(x)).map((x) => (
          <span key={x} className="seg-chip"><span lang="ar">{x}</span><span className="text-[10px] text-t3">{t("proclitic")}</span></span>
        ))}
        <span className="seg-chip is-stem"><span lang="ar">{tk.stem}</span><span className="text-[10px] text-t3">{t("stem")}</span></span>
        {tk.clitics.filter((x) => !tk.key.startsWith(x)).map((x) => (
          <span key={x} className="seg-chip"><span lang="ar">{x}</span><span className="text-[10px] text-t3">{t("enclitic")}</span></span>
        ))}
      </span>
    );
  }
  return <span className="text-t3">—</span>;
}

function TokenRow({ tk, pick, onPick }: { tk: AnalysedToken; pick: number; onPick: (i: number) => void }) {
  const t = useTranslations("analyse");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const c = tk.kind === "particle" ? tk.particle : (tk.candidates[pick] ?? tk.candidates[0]);
  const unsure = tk.kind !== "particle" && tk.confidence < REVIEW_BELOW;
  const f = c?.features;
  // a word's inflection belongs to its place: shown for Quranic text read where it stands, never borrowed
  // from another occurrence for the reader's own sentence
  const placed = tk.kind === "gold";
  const gram = (placed
    ? [label(f?.pos, locale), label(f?.derivation, locale), label(f?.aspect, locale), label(f?.voice, locale), label(f?.case, locale), label(f?.mood, locale)]
    : [label(f?.pos, locale), label(f?.derivation, locale)]
  ).filter(Boolean).join(" • ");
  const posTerm = c?.pos ? TAG_TERM[c.pos] : undefined;
  return (
    <div className={"analyse-row" + (unsure ? " is-unsure" : "")} role="row" data-kind={tk.kind}>
      <span role="cell" className={tk.kind === "gold" ? "quran text-[21px] leading-[1.7]" : "ar-classical text-[21px] leading-[1.5]"} lang="ar" dir="rtl">
        {tk.surface}
      </span>
      <span role="cell"><Segments c={c} tk={tk} /></span>
      <span role="cell" className="flex flex-col">
        {tk.kind !== "particle" && c?.root ? (
          <Link href={`/concordance?root=${encodeURIComponent(c.root.key)}`} className="ar-classical text-[16px] text-root hover:underline" lang="ar" title={t("rootToConcordance")}>
            {c.root.spaced}
          </Link>
        ) : (
          <span className="text-t3">—</span>
        )}
        {tk.kind !== "particle" && c?.pattern && <span className="ar-classical text-[15px] text-form" lang="ar">{c.pattern.ar}</span>}
      </span>
      <span role="cell" className="flex min-w-0 flex-col gap-0.5 text-[12.5px]">
        {tk.kind === "particle" ? (
          <span>{t("particle")}{label(c?.features?.pos, locale) ? ` • ${label(c?.features?.pos, locale)}` : ""}</span>
        ) : tk.kind === "none" ? (
          <span className="text-t3">{t("nothingFound")}</span>
        ) : (
          <>
            <span>
              {posTerm && gram ? <Term id={posTerm}>{gram}</Term> : gram || (tk.kind === "pattern" ? t("byPattern", { pattern: c?.pattern?.ar ?? "" }) : "")}
              {c?.lemma && <span className="ar-classical text-[14px]" lang="ar">{" • "}{c.lemma.ar}</span>}
            </span>
            {/* English on its own line, never inside the Arabic run (SHL-F07) */}
            {c?.gloss_en && (
              <span className="text-[12px] text-t3" lang="en" dir="ltr">
                {c.gloss_en}
              </span>
            )}
            <span className="text-[11.5px] text-t3">
              {t(tk.kind === "pattern" && tk.clitics.length ? "how_pattern_clitic" : `how_${tk.kind}`, { ...cnt(c?.count ?? 0, locale), clitics: tk.clitics.join("، ") })}
              {c?.location && (
                <>
                  {" • "}
                  <Link href={`/word/${c.location}`} className="underline-offset-2 hover:underline" dir="ltr">{locale === "ar" ? toArabicDigits(c.location) : c.location}</Link>
                </>
              )}
              {c?.lemma && (
                <>
                  {" • "}
                  <Link href={`/read?w=${encodeURIComponent(c.lemma.slug)}`} className="underline-offset-2 hover:underline">{t("entry")}</Link>
                </>
              )}
            </span>
            {tk.candidates.length > 1 && (
              <span>
                <button type="button" className="choose-link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                  {t("choose", { n: formatNumber(tk.candidates.length, locale) })}
                </button>
                {open && (
                  <ul className="choose-list" role="listbox" aria-label={t("chooseLabel", { word: tk.surface })}>
                    {tk.candidates.map((x, i) => (
                      <li key={i}>
                        <button type="button" role="option" aria-selected={i === pick} className={"choose-row" + (i === pick ? " is-on" : "")} onClick={() => { onPick(i); setOpen(false); }}>
                          <span className="ar-classical text-[15px] text-root" lang="ar">{x.root?.spaced ?? "—"}</span>
                          <span className="ar-classical text-[14px]" lang="ar">{x.lemma?.ar ?? x.pattern?.ar ?? ""}</span>
                          <span className="flex-1 text-[11.5px] text-t3">{label(x.features?.pos, locale) ?? ""}</span>
                          <span className="mono text-[11px]">{conf(x.confidence, locale)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            )}
          </>
        )}
      </span>
      <span role="cell" className={"mono text-end text-[11px] " + (tk.confidence >= REVIEW_BELOW ? "text-good" : "text-amber")}>
        {conf(tk.confidence, locale)}
      </span>
    </div>
  );
}
