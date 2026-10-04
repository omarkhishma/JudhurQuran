"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Term } from "@/components/terms/Term";
import { Link, useRouter } from "@/i18n/navigation";
import { hasArabic } from "@/lib/arabic/normalize";
import { useIsClient } from "@/lib/client";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { searchMyTexts } from "@/lib/library/searchTexts";
import { getJSON } from "@/lib/reader/api";
import { useDebounced } from "@/lib/useDebounced";

type Verse = { key: string; surah: number; ayah: number; text_qpc: string; text_imlaei: string; name_ar: string; name_translit: string };
type Root = { key: string; letters?: string[]; spaced: string; translit: string; occurrences: number; lemma_count: number; verse_count?: number; gist_ar?: string | null; gloss_en?: string | null };
type Lemma = { id: number; slug?: string; ar: string; envelope?: { translit: string }; translit?: string | null; pos: string; pos_label?: { ar: string; en: string }; occurrences: number; root: string | null; root_spaced?: string; gloss_en?: string | null; senses_en?: string[]; pattern?: string | null };
type DictEntry = { entry_id: number; work: { id: string; title_ar: string; title_en: string; author_ar: string; author_en: string; lang: string } | null; root_key: string | null; root_spaced: string | null; dict_root?: string | null; headword: string; excerpt: string | null };
/** A root of the dictionary (P11.1): the Quran's or not. */
type DictRootHit = { key: string; display: string; letters: number; quran_root: string | null; lexica: number };
type Passage = { uri: string; ref: string; text: { slug: string; kind: string }; verse?: Verse; highlight_ar?: string | null; highlight_en?: string | null; trans_en?: string | null };
export type SearchPayload = {
  query: string;
  engine?: string;
  detected: { kind: string; label_ar: string; label_en: string; surah?: number; ayah?: number; word?: number; to?: number | null; number?: number; pattern?: string; ar?: string; translit?: string };
  results: {
    verses: Verse[];
    surahs: { number: number; name_ar: string; name_translit: string; verse_count: number; revelation_place?: string }[];
    roots: Root[];
    lemmas: Lemma[];
    words: { form: string; display: string; occurrences: number; sample: string; lemma_id: number | null; lemma: string | null; root: string | null; exact: boolean; rasm_differs?: boolean; mushaf?: string }[];
    patterns?: { slug: string; ar: { full: string; translit: string }; lemma_count: number; occurrences?: number; form_number?: number | null }[];
    passages?: Passage[];
    dictionary?: DictEntry[];
    dict_roots?: DictRootHit[];
  };
  totals?: Partial<Record<"verses" | "lemmas" | "roots" | "patterns" | "surahs" | "dictionary" | "words", number>>;
};

const KINDS = ["verses", "words", "roots", "patterns", "surahs"] as const;
const SOURCES = ["dictionary", "mine"] as const;
type Kind = (typeof KINDS)[number] | (typeof SOURCES)[number];
const ALL: Kind[] = [...KINDS, ...SOURCES];
const EXAMPLES = ["الرحمن", "ك ت ب", "2:255", "الصلاة", "مَفْعُول", "s-b-r", "mercy"];
const REFERENCE = ["verse_ref", "word_loc", "juz", "hizb", "page"];
const DETECT_NOTE: Record<string, string> = {
  verse_ref: "noteVerse",
  word_loc: "noteWordLoc",
  juz: "noteDivision",
  hizb: "noteDivision",
  page: "noteDivision",
  root: "noteRoot",
  pattern: "notePattern",
  arabic_word: "noteArabic",
  arabic_phrase: "noteArabic",
  latin: "noteLatin",
  translit: "noteTranslit",
  english: "noteEnglish",
  surah: "noteSurah",
};
const PAGE = 30;
// a hamza on any seat is the stored ء, alef maqṣūra the stored ي (SRC-15), as the API folds them
const RADICAL: Record<string, string> = { "أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", "ٱ": "ء", "ى": "ي" };
const foldRadical = (c: string) => RADICAL[c] ?? c;

/** «⁨…⁩» from the search index's highlight (FSI…PDI) becomes a <mark>, bidi-safe. */
function Highlight({ text }: { text: string }) {
  const parts = text.split(/⁨|⁩/);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i} className="kwic-key">{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

type VerseRow = { verse: Verse; highlight?: string | null; trans?: string | null };
const verseRowsOf = (d: SearchPayload): VerseRow[] =>
  d.results.passages?.length ? d.results.passages.filter((p) => p.verse).map((p) => ({ verse: p.verse!, highlight: p.highlight_ar, trans: p.highlight_en ?? p.trans_en })) : d.results.verses.map((v) => ({ verse: v }));

/**
 * One kind, paged (SRC-12, 21, 23): the first page comes with the search, each "show more" reveals `step`
 * more and asks the API for the next page when the loaded rows run out. Counts are the matches, not the rows.
 */
function usePaged<T>(dq: string, only: "verses" | "lemmas" | "dictionary", first: T[], total: number, pick: (d: SearchPayload) => T[], key: (x: T) => string, step: number) {
  const [state, setState] = useState({ dq, shown: step });
  const shown = state.dq === dq ? state.shown : step;
  const pages = Math.max(0, Math.ceil((Math.min(shown, total) - first.length) / PAGE));
  const extra = useQueries({
    queries: Array.from({ length: pages }, (_, i) => ({
      queryKey: ["search-page", dq, only, i],
      queryFn: () => getJSON<SearchPayload>(`/search?q=${encodeURIComponent(dq)}&limit=${PAGE}&offset=${PAGE * (i + 1)}&only=${only}`),
      staleTime: Infinity,
    })),
  });
  const seen = new Set<string>();
  const rows = [...first, ...extra.flatMap((x) => (x.data ? pick(x.data) : []))].filter((x) => !seen.has(key(x)) && !!seen.add(key(x)));
  return {
    rows: rows.slice(0, shown),
    total,
    loading: extra.some((x) => x.isFetching),
    more: shown < total ? () => setState({ dq, shown: shown + step }) : null,
  };
}

/**
 * Search (design 05 §5.2, inventory SRC-01…43 with the Quran notes SRC-Q01…Q07): live results as you
 * type, what the query was understood as, kind and source facets with the true count of matches, a
 * positional root builder (first radical on the right), ayat first with the keyword marked, words (all the
 * words on a pattern when the query names one), roots with their meaning, patterns leading to their words,
 * sūras, dictionary entries, and the reader's own texts searched in the browser; a verse reference or range
 * is pinned and Enter goes to it; kinds and letters live in the URL; empty, loading and error states, and a
 * note when the simpler engine answers.
 */
export function SearchScreen({ initialQ, initial, initialKinds, initialLetters }: { initialQ: string; initial: SearchPayload | null; initialKinds: string; initialLetters: string }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const client = useIsClient();
  const [q, setQ] = useState(initialQ);
  const dq = useDebounced(q.trim(), 160);
  const [kinds, setKinds] = useState<Record<Kind, boolean>>(() => {
    const on = initialKinds ? new Set(initialKinds.split(",")) : null;
    return Object.fromEntries(ALL.map((k) => [k, on ? on.has(k) : true])) as Record<Kind, boolean>;
  });
  const [letters, setLetters] = useState<[string, string, string]>(() => {
    const l = initialLetters.split(",");
    return [l[0] ?? "", l[1] ?? "", l[2] ?? ""].map((x) => [...x].pop() ?? "") as [string, string, string];
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const res = useQuery({
    queryKey: ["search", dq],
    queryFn: () => getJSON<SearchPayload>(`/search?q=${encodeURIComponent(dq)}&limit=${PAGE}`),
    enabled: dq.length > 0,
    initialData: dq === initialQ.trim() && initial ? initial : undefined,
    placeholderData: (prev) => prev,
  });
  const lettered = letters.some(Boolean);
  const byLetters = useQuery({
    queryKey: ["roots-by-letters", letters.join("|")],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "200" });
      letters.forEach((l, i) => l && p.set(`l${i + 1}`, l));
      return getJSON<{ data: Root[]; total: number }>(`/roots?${p}`);
    },
    enabled: lettered && !dq,
  });
  const mine = useQuery({ queryKey: ["search-mine", dq], queryFn: () => searchMyTexts(dq), enabled: client && dq.length > 1 });

  // The address bar carries the query, the kinds turned on and the root letters, so a search can be shared
  // and reloaded as it was (SRC-31, SHL-S04).
  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (k: string, v: string) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    set("q", dq);
    set("k", ALL.every((k) => kinds[k]) ? "" : ALL.filter((k) => kinds[k]).join(","));
    set("l", lettered ? letters.join(",") : "");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url.href);
  }, [dq, kinds, letters, lettered]);

  const data = dq ? res.data : undefined;
  const r = data?.results;
  const totals = data?.totals ?? {};
  const detected = data?.detected;
  const reference = !!detected && REFERENCE.includes(detected.kind);
  const firstVerses = useMemo(() => (data ? verseRowsOf(data) : []), [data]);
  const verses = usePaged(dq, "verses", firstVerses, reference ? firstVerses.length : (totals.verses ?? firstVerses.length), verseRowsOf, (x) => x.verse.key, 20);

  // the letters narrow roots and words by position, with the hamza seats folded (SRC-15)
  const fits = (l: string[] | undefined) => !!l && letters.every((x, i) => !x || foldRadical(x) === l[i]);
  const firstLemmas = useMemo(() => r?.lemmas ?? [], [r]);
  const words = usePaged(dq, "lemmas", firstLemmas, totals.lemmas ?? firstLemmas.length, (d) => d.results.lemmas, (x) => String(x.id), 12);
  const shownWords = lettered ? words.rows.filter((l) => fits(l.root ? [...l.root].map(foldRadical) : undefined)) : words.rows;
  const roots = lettered ? (r ? r.roots.filter((x) => fits(x.letters)) : (byLetters.data?.data ?? [])) : (r?.roots ?? []);
  const rootsTotal = lettered && !r ? (byLetters.data?.total ?? 0) : roots.length;
  const firstDict = useMemo(() => r?.dictionary ?? [], [r]);
  const dict = usePaged(dq, "dictionary", firstDict, totals.dictionary ?? firstDict.length, (d) => d.results.dictionary ?? [], (x) => String(x.entry_id), 5);
  const patterns = r?.patterns ?? [];
  const surahs = r?.surahs ?? [];
  const mineHits = dq ? (mine.data?.hits ?? []) : [];
  const counts: Record<Kind, number> = {
    verses: verses.total,
    words: lettered ? shownWords.length : words.total,
    roots: rootsTotal,
    patterns: patterns.length,
    surahs: surahs.length,
    dictionary: dict.total + (r?.dict_roots?.length ?? 0),
    mine: dq ? (mine.data?.total ?? 0) : 0,
  };
  const total = ALL.reduce((a, k) => a + (kinds[k] ? counts[k] : 0), 0); // only what is shown (SRC-26)
  const exact = reference ? firstVerses[0]?.verse : undefined;
  const range = detected?.kind === "verse_ref" && detected.to && firstVerses.length > 1 ? `${verseRef(firstVerses[0].verse.key, locale)}–${formatNumber(firstVerses[firstVerses.length - 1].verse.ayah, locale)}` : null;
  // a word's place opens the word there; a verse its panel; a juzʾ, ḥizb or page the reading where it begins
  const exactHref = exact ? (detected?.kind === "word_loc" ? `/word/${exact.surah}:${exact.ayah}:${detected.word}` : detected?.kind === "verse_ref" ? `/quran/${exact.surah}/${exact.ayah}` : `/quran/${exact.surah}#v${exact.ayah}`) : null;
  // the verses as a concordance: the root asked for, or the root of the first word found
  const concordanceHref = detected?.kind === "root" && r?.roots[0] ? `/concordance?root=${encodeURIComponent(r.roots[0].key)}` : words.rows[0]?.slug && words.rows[0].root ? `/concordance?w=${encodeURIComponent(words.rows[0].slug)}` : null;
  // initial results come from the server render, so "has data" — not "has fetched" — decides
  const empty = !!dq && !!data && !res.isError && total === 0 && !mine.isFetching;
  const onPattern = detected?.kind === "pattern";
  // plan B28: the word typed as everyday spelling is written otherwise in the mushaf — said, with the term
  const spelled = (r?.words ?? []).filter((w) => w.exact).sort((a, b) => b.occurrences - a.occurrences)[0];
  const spelledNote = spelled?.rasm_differs && spelled.mushaf ? spelled : null;

  function setLetter(i: number, v: string) {
    const ch = [...v.replace(/[^ء-ي]/g, "")].pop() ?? "";
    const next = [...letters] as [string, string, string];
    next[i] = ch;
    setLetters(next);
    if (ch && i < 2) boxes.current[i + 1]?.focus(); // typing advances (SRC-37, SRC-Q04)
  }
  const facetRow = (k: Kind, label: string) => (
    <label key={k} className="facet-row">
      <input type="checkbox" checked={kinds[k]} onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })} />
      <span className="flex-1">{label}</span>
      <span className="mono text-[11px] text-t3">{formatNumber(counts[k], locale)}</span>
    </label>
  );

  const facets = (
    <div className="search-facets">
      <fieldset className="flex flex-col gap-1">
        <legend className="label-caps mb-1">{t("facetKind")}</legend>
        {KINDS.map((k) => facetRow(k, t(`kind_${k}`)))}
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="label-caps mb-1">{t("facetSource")}</legend>
        {facetRow("verses", t("sourceQuran"))}
        {facetRow("dictionary", t("sourceDictionaries"))}
        {facetRow("mine", t("sourceMine"))}
        <p className="text-[11px] leading-relaxed text-t3">{t("sourceMineNote")}</p>
        <p className="text-[11px] leading-relaxed text-t3">{t("sourcesNext")}</p>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="label-caps mb-1">{t("rootBuilder")}</legend>
        <div className="flex gap-1.5" dir="rtl">
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              value={letters[i]}
              onChange={(e) => setLetter(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !letters[i] && i > 0) boxes.current[i - 1]?.focus();
              }}
              className="letter-box"
              aria-label={t("letter", { n: formatNumber(i + 1, locale) })}
              placeholder="–"
              lang="ar"
              dir="rtl"
              inputMode="text"
            />
          ))}
          {lettered && (
            <button type="button" className="text-[11.5px] text-t3 hover:text-t1" onClick={() => setLetters(["", "", ""])}>
              {t("clearLetters")}
            </button>
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-t3">{t("rootBuilderHint")}</p>
      </fieldset>
    </div>
  );

  return (
    <div className="search-screen">
      <form
        role="search"
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          // an exact reference goes straight to its verse (SRC-05, SRC-Q01)
          if (exactHref) router.push(exactHref);
        }}
      >
        <Icon name="search" size={17} className="text-t3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t("pageTitle")}
          placeholder={t("placeholder")}
          dir="auto"
          className={"search-input " + (hasArabic(q) ? "ar-classical" : "")}
          enterKeyHint="search"
          autoFocus={!initialQ}
        />
        <span className="text-[12px] text-t3" aria-live="polite">{dq && data ? t("totalN", cnt(total, locale)) : ""}</span>
      </form>
      <div className="search-detect" aria-live="polite">
        <span className="text-t3">{t("understoodAs")}</span>
        <span className={"detect-pill" + (detected?.kind === "root" ? " is-root" : onPattern ? " is-form" : "")}>
          {detected ? (locale === "ar" ? detected.label_ar : detected.label_en) : "—"}
          {onPattern && detected?.ar && (
            <span className="ar-classical ms-1.5 text-[15px]" lang="ar">
              {detected.ar}
            </span>
          )}
        </span>
        <span className="text-t3">{detected ? (DETECT_NOTE[detected.kind] ? t(DETECT_NOTE[detected.kind]) : "") : t("typeQuery")}</span>
        {exactHref && (
          <Link href={exactHref} className="btn ms-auto min-h-[32px]">
            {range ? t("goToRange", { ref: range }) : detected?.kind === "word_loc" ? t("goToWord", { ref: verseRef(`${exact!.key}:${detected.word}`, locale) }) : t("goToVerse", { ref: verseRef(exact!.key, locale) })}
          </Link>
        )}
      </div>
      {data?.engine === "postgres" && (
        <p className="search-fallback" role="note">
          {t("fallbackNote")}
        </p>
      )}
      <button type="button" className="btn search-filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
        <Icon name="sliders" size={13} />
        {t("filters")}
      </button>
      <div className="search-body">
        <aside className={"search-side" + (filtersOpen ? " is-open" : "")} aria-label={t("filters")}>
          {facets}
        </aside>
        <div className="search-results" aria-busy={res.isFetching}>
          {!dq && !lettered && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-t2">{t("hint")}</p>
              <ul className="flex flex-wrap gap-2">
                {EXAMPLES.map((e) => (
                  <li key={e}>
                    <button type="button" className="chip min-h-[36px]" onClick={() => setQ(e)} dir="auto">{e}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dq && !res.data && res.isFetching && (
            <div className="flex flex-col gap-2" role="status" aria-label={t("loading")}>
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-card-2" />)}
            </div>
          )}
          {res.isError && (
            <p className="rounded-xl border border-line bg-card p-4 text-[13px] text-bad" role="alert">
              {t("error")} <button type="button" className="underline" onClick={() => res.refetch()}>{t("retry")}</button>
            </p>
          )}
          {empty && (
            <div className="rounded-xl border border-line bg-card p-5 text-[13.5px] text-t2">
              <p>{t("emptyFor", { q: dq })}</p>
              <p className="mt-2">
                <Link href={`/read?mode=ask&q=${encodeURIComponent(dq)}`} className="text-word underline">{t("askInstead")}</Link>
              </p>
            </div>
          )}
          {kinds.verses && verses.rows.length > 0 && (
            <ResultGroup title={t("sectionVerses")} n={verses.total} link={concordanceHref ? { href: concordanceHref, label: t("openConcordance") } : undefined}>
              <ul className="flex flex-col gap-2">
                {verses.rows.map(({ verse: v, highlight, trans }) => (
                  <li key={v.key}>
                    <Link href={`/quran/${v.surah}/${v.ayah}`} className="result-row is-verse">
                      <span className="dot" style={{ background: "var(--c-sentence)" }} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="ar-classical text-[17px] leading-[1.9] text-t1" lang="ar" dir="rtl">
                          {highlight ? <Highlight text={highlight} /> : v.text_imlaei}
                        </span>
                        {trans && locale === "en" && <span className="truncate text-[12px] text-t2" lang="en" dir="ltr"><Highlight text={trans} /></span>}
                      </span>
                      <span className="mono shrink-0 text-[11px] text-t3" dir="ltr">{verseRef(v.key, locale)}</span>
                      <span className="shrink-0 text-[11.5px] text-t3" lang="ar">{v.name_ar}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <More paged={verses} />
            </ResultGroup>
          )}
          {kinds.words && shownWords.length > 0 && (
            <ResultGroup title={onPattern && detected?.ar ? t("sectionLemmasOnPattern", { pattern: detected.ar }) : t("sectionLemmas")} n={counts.words}>
              <ul className="result-grid">
                {shownWords.map((l) => (
                  <li key={l.id}>
                    <Link href={l.slug ? `/read?w=${encodeURIComponent(l.slug)}` : `/search?q=${encodeURIComponent(l.ar)}`} className="result-row">
                      <span className="dot" style={{ background: "var(--c-word)" }} />
                      <span className="ar-classical min-w-[80px] text-[20px] text-word" lang="ar" dir="rtl">{l.ar}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-t2">
                        {[l.envelope?.translit ?? l.translit, locale === "ar" ? l.pos_label?.ar : (l.gloss_en ?? l.senses_en?.[0])].filter(Boolean).join(" • ")}
                      </span>
                      {l.root_spaced && <span className="ar-classical shrink-0 text-[15px] text-root" lang="ar">{l.root_spaced}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              {!lettered && <More paged={words} />}
              {spelledNote && (
                <p className="mt-2 text-[12.5px] text-t2" data-testid="rasm-note">
                  {t.rich("rasmNote", {
                    mushaf: () => (
                      <span className="quran text-[17px]" lang="ar" dir="rtl">
                        {spelledNote.mushaf}
                      </span>
                    ),
                    term: (c) => <Term id="rasm">{c}</Term>,
                  })}
                </p>
              )}
              {(r?.words.length ?? 0) > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-t3">
                  {t("formsLead")}
                  {r!.words.slice(0, 10).map((w) => (
                    <Link key={`${w.form}-${w.lemma_id}`} href={`/word/${w.sample}`} className="chip" title={t("formMeta", cnt(w.occurrences, locale))}>
                      <span className="ar-classical text-[15px]" lang="ar">{w.display}</span>
                      <span className="mono text-[10.5px]">{formatNumber(w.occurrences, locale)}</span>
                    </Link>
                  ))}
                </p>
              )}
            </ResultGroup>
          )}
          {kinds.roots && roots.length > 0 && (
            <ResultGroup title={t("sectionRoots")} n={rootsTotal} link={{ href: "/concordance", label: t("concordanceLink") }}>
              <ul className="result-grid">
                {roots.slice(0, lettered && !r ? 200 : 12).map((x) => (
                  <li key={x.key}>
                    <Link href={`/concordance?root=${encodeURIComponent(x.key)}`} className="result-row is-root">
                      <span className="dot" style={{ background: "var(--c-root)" }} />
                      <span className="ar-classical min-w-[80px] text-[20px] tracking-[.06em] text-root" lang="ar" dir="rtl">{x.spaced}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="mono truncate text-[11.5px] text-t3" dir="ltr">{x.translit}</span>
                        {/* the root's meaning: Ibn Fāris's statement, or the English gloss where one exists (SRC-18) */}
                        {locale !== "ar" && x.gloss_en ? (
                          <span className="truncate text-[12px] text-t2">{x.gloss_en}</span>
                        ) : (
                          x.gist_ar && <span className="truncate text-[12.5px] text-t2" lang="ar" dir="rtl">{x.gist_ar}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-t3">{t("rootMetaN", { ...cnt(x.occurrences, locale) })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          )}
          {kinds.patterns && patterns.length > 0 && (
            <ResultGroup title={t("sectionPatterns")} n={patterns.length}>
              <ul className="result-grid">
                {patterns.slice(0, 6).map((p) => (
                  <li key={p.slug}>
                    {/* a pattern leads to its words (SRC-20): the query that names it lists them */}
                    <Link href={`/search?q=${encodeURIComponent(p.ar.full)}`} className="result-row" aria-current={onPattern && detected?.pattern === p.slug ? "true" : undefined}>
                      <span className="dot" style={{ background: "var(--c-form)" }} />
                      <span className="ar-classical min-w-[80px] text-[20px] text-form" lang="ar" dir="rtl">{p.ar.full}</span>
                      <span className="mono min-w-0 flex-1 truncate text-[11.5px] text-t3" dir="ltr">{p.ar.translit}</span>
                      <span className="shrink-0 text-[11.5px] text-t3">{t("wordsOnPattern", cnt(p.lemma_count, locale))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          )}
          {kinds.surahs && surahs.length > 0 && (
            <ResultGroup title={t("sectionSurahs")} n={surahs.length}>
              <ul className="result-grid">
                {surahs.map((s) => (
                  <li key={s.number}>
                    <Link href={`/quran/${s.number}`} className="result-row">
                      <span className="dot" style={{ background: "var(--c-sentence)" }} />
                      <span className="ar-classical flex-1 text-[20px]" lang="ar">{`سورة ${s.name_ar}`}</span>
                      <span className="shrink-0 text-[11.5px] text-t3">{t("versesN", cnt(s.verse_count, locale))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          )}
          {kinds.dictionary && (dict.rows.length > 0 || (r?.dict_roots?.length ?? 0) > 0) && (
            <ResultGroup title={t("sectionDictionary")} n={dict.total + (r?.dict_roots?.length ?? 0)}>
              {/* the roots themselves first: a page each in the dictionary, the Quran's or not (P11.1) */}
              {(r?.dict_roots?.length ?? 0) > 0 && (
                <ul className="mb-3 flex flex-wrap gap-2" aria-label={t("dictRoots")}>
                  {r!.dict_roots!.map((x) => (
                    <li key={x.key}>
                      <Link href={`/dictionary/${encodeURIComponent(x.key)}`} className="chip min-h-[40px] gap-2">
                        <span className="ar-classical text-[18px]" lang="ar">{x.display}</span>
                        <span className="text-[11.5px] text-t3">{x.quran_root ? t("dictRootQuran") : t("dictRootLexica", cnt(x.lexica, locale))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <ul className="flex flex-col gap-2">
                {dict.rows.map((e) => {
                  const body = (
                    <>
                      <span className="dot" style={{ background: "var(--c-desc)" }} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="ar-classical text-[18px] text-t1" lang="ar">{e.headword}</span>
                          {e.work && <span className="text-[11.5px] text-t3">{t("dictBy", locale === "ar" ? { title: e.work.title_ar, author: e.work.author_ar } : { title: e.work.title_en, author: e.work.author_en })}</span>}
                        </span>
                        {e.excerpt && (
                          <span className={"line-clamp-2 text-[13px] leading-relaxed text-t2" + (e.work?.lang === "ar" ? " ar-classical text-[15px]" : "")} lang={e.work?.lang === "en" ? "en" : "ar"} dir={e.work?.lang === "en" ? "ltr" : "rtl"}>
                            <Highlight text={e.excerpt} />
                          </span>
                        )}
                      </span>
                      {e.root_spaced && <span className="ar-classical shrink-0 text-[15px] text-root" lang="ar">{e.root_spaced}</span>}
                    </>
                  );
                  // an article opens on its root's page in the dictionary, every lexicon's article beside it
                  const href = e.dict_root ? `/dictionary/${encodeURIComponent(e.dict_root)}` : e.root_key ? `/roots/${encodeURIComponent(e.root_key)}#lexicon` : null;
                  return <li key={e.entry_id}>{href ? <Link href={href} className="result-row">{body}</Link> : <div className="result-row">{body}</div>}</li>;
                })}
              </ul>
              <More paged={dict} />
            </ResultGroup>
          )}
          {kinds.mine && mineHits.length > 0 && (
            <ResultGroup title={t("sectionMine")} n={counts.mine}>
              <ul className="flex flex-col gap-2">
                {mineHits.map((h) => (
                  <li key={`${h.id}-${h.passage}`}>
                    <Link href={`/library/text/${h.id}#p${h.passage}`} className="result-row">
                      <span className="dot" style={{ background: "var(--c-sentence)" }} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="ar-classical text-[16px] leading-[1.8] text-t1" lang="ar" dir="rtl">
                          {h.before && `… ${h.before} `}
                          <mark className="kwic-key">{h.match}</mark>
                          {h.after && ` ${h.after} …`}
                        </span>
                        <span className="text-[11.5px] text-t3">{t("mineIn", { title: h.title, n: formatNumber(h.passage, locale) })}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          )}
        </div>
      </div>
    </div>
  );
}

function More({ paged }: { paged: { rows: unknown[]; total: number; loading: boolean; more: (() => void) | null } }) {
  const t = useTranslations("search");
  const locale = useLocale();
  if (!paged.more && !paged.loading) return null;
  return (
    <button type="button" className="btn mt-2 self-start" onClick={paged.more ?? undefined} disabled={paged.loading}>
      {paged.loading ? t("loadingMore") : t("showMore", { shown: formatNumber(paged.rows.length, locale), total: formatNumber(paged.total, locale) })}
    </button>
  );
}

function ResultGroup({ title, n, link, children }: { title: string; n: number; link?: { href: string; label: string }; children: React.ReactNode }) {
  const locale = useLocale();
  return (
    <section className="result-group">
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-medium text-t1">{title}</h2>
        <span className="mono text-[11px] text-t3">{formatNumber(n, locale)}</span>
        <span className="h-px flex-1 bg-line" />
        {link && <Link href={link.href} className="text-[11.5px] text-t3 hover:text-t1">{link.label}</Link>}
      </div>
      {children}
    </section>
  );
}
