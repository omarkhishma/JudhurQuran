"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Link, useRouter } from "@/i18n/navigation";
import { hasArabic } from "@/lib/arabic/normalize";
import { cnt, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { useDebounced } from "@/lib/useDebounced";

type Verse = { key: string; surah: number; ayah: number; text_qpc: string; text_imlaei: string; name_ar: string; name_translit: string };
export type SearchPayload = {
  query: string;
  engine?: string;
  detected: { kind: string; label_ar: string; label_en: string; surah?: number; ayah?: number; number?: number };
  results: {
    verses: Verse[];
    surahs: { number: number; name_ar: string; name_translit: string; verse_count: number; revelation_place?: string }[];
    roots: { key: string; spaced: string; translit: string; occurrences: number; lemma_count: number; verse_count: number }[];
    lemmas: { id: number; slug?: string; ar: string; envelope?: { translit: string }; pos: string; pos_label?: { ar: string; en: string }; occurrences: number; root: string | null; root_spaced?: string; gloss_en?: string | null; senses_en?: string[] }[];
    words: { form: string; display: string; occurrences: number; sample: string; lemma_id: number | null; lemma: string | null; root: string | null; exact: boolean }[];
    patterns?: { slug: string; ar: { full: string; translit: string }; lemma_count: number; occurrences?: number; form_number?: number | null }[];
    passages?: { uri: string; ref: string; text: { slug: string; kind: string }; verse?: Verse; highlight_ar?: string | null; highlight_en?: string | null; trans_en?: string | null }[];
  };
};
type RootRow = { key: string; spaced: string; translit: string; occurrences: number; lemma_count: number };

const KINDS = ["verses", "words", "roots", "patterns", "surahs"] as const;
type Kind = (typeof KINDS)[number];
const EXAMPLES = ["الرحمن", "ك ت ب", "2:255", "الصلاة", "مَفْعُول", "s-b-r", "mercy"];
const DETECT_NOTE: Record<string, string> = {
  verse_ref: "noteVerse",
  juz: "noteDivision",
  hizb: "noteDivision",
  page: "noteDivision",
  root: "noteRoot",
  arabic_word: "noteArabic",
  arabic_phrase: "noteArabic",
  latin: "noteLatin",
  surah: "noteSurah",
};

/** «⁨…⁩» from the search index's highlight (FSI…PDI) becomes a <mark>, bidi-safe. */
function Highlight({ text }: { text: string }) {
  const parts = text.split(/⁨|⁩/);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i} className="kwic-key">{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

/**
 * Search (design 05 §5.2, inventory SRC-01…43 with the Quran notes SRC-Q01…Q07): live results as you
 * type, what the query was understood as, kind and source facets with their counts, a positional root
 * builder (first radical on the right), ayat first with the keyword marked, roots, words, patterns and
 * sūras; a verse reference is pinned and Enter goes to it; empty, loading and error states.
 */
export function SearchScreen({ initialQ, initial }: { initialQ: string; initial: SearchPayload | null }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const dq = useDebounced(q.trim(), 160);
  const [kinds, setKinds] = useState<Record<Kind, boolean>>({ verses: true, words: true, roots: true, patterns: true, surahs: true });
  const [letters, setLetters] = useState<[string, string, string]>(["", "", ""]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const res = useQuery({
    queryKey: ["search", dq],
    queryFn: () => getJSON<SearchPayload>(`/search?q=${encodeURIComponent(dq)}&limit=30`),
    enabled: dq.length > 0,
    initialData: dq === initialQ.trim() && initial ? initial : undefined,
    placeholderData: (prev) => prev,
  });
  const lettered = letters.some(Boolean);
  const byLetters = useQuery({
    queryKey: ["roots-by-letters", letters.join("|")],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "60" });
      letters.forEach((l, i) => l && p.set(`l${i + 1}`, l));
      return getJSON<{ data: RootRow[] }>(`/roots?${p}`);
    },
    enabled: lettered,
  });

  // The address bar carries the query, so a search can be shared and reloaded (SRC-31).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (dq) url.searchParams.set("q", dq);
    else url.searchParams.delete("q");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url.href);
  }, [dq]);

  const data = dq ? res.data : undefined;
  const r = data?.results;
  // Ayat: exact references first, then the index's passages with the keyword marked, without repeats.
  const verseRows = useMemo(() => {
    if (!r) return [] as { verse: Verse; highlight?: string | null; trans?: string | null }[];
    const seen = new Set<string>();
    const out: { verse: Verse; highlight?: string | null; trans?: string | null }[] = [];
    const push = (row: { verse: Verse; highlight?: string | null; trans?: string | null }) => {
      if (seen.has(row.verse.key)) return;
      seen.add(row.verse.key);
      out.push(row);
    };
    const reference = data && ["verse_ref", "juz", "hizb", "page"].includes(data.detected.kind);
    // a reference pins its verse first; otherwise the index's ranked passages (keyword marked) lead
    if (reference) r.verses.forEach((v) => push({ verse: v }));
    for (const p of r.passages ?? []) if (p.verse) push({ verse: p.verse, highlight: p.highlight_ar, trans: p.highlight_en ?? p.trans_en });
    r.verses.forEach((v) => push({ verse: v }));
    return out;
  }, [r, data]);
  const letterKeys = useMemo(() => new Set((byLetters.data?.data ?? []).map((x) => x.key)), [byLetters.data]);
  const roots = lettered
    ? r
      ? r.roots.filter((x) => letterKeys.has(x.key))
      : (byLetters.data?.data ?? [])
    : (r?.roots ?? []);
  const words = r?.lemmas ?? [];
  const patterns = r?.patterns ?? [];
  const surahs = r?.surahs ?? [];
  const counts: Record<Kind, number> = { verses: verseRows.length, words: words.length, roots: roots.length, patterns: patterns.length, surahs: surahs.length };
  const total = KINDS.reduce((a, k) => a + (kinds[k] ? counts[k] : 0), 0); // only what is shown (SRC-26)
  const detected = data?.detected;
  const exact = detected && ["verse_ref", "juz", "hizb", "page"].includes(detected.kind) ? verseRows[0]?.verse : undefined;
  const exactHref = exact ? (detected?.kind === "verse_ref" ? `/quran/${exact.surah}/${exact.ayah}` : `/quran/${exact.surah}#v${exact.ayah}`) : null;
  // initial results come from the server render, so "has data" — not "has fetched" — decides
  const empty = !!dq && !!data && !res.isError && total === 0;

  function setLetter(i: number, v: string) {
    const ch = [...v.replace(/[^ء-ي]/g, "")].pop() ?? "";
    const next = [...letters] as [string, string, string];
    next[i] = ch;
    setLetters(next);
    if (ch && i < 2) boxes.current[i + 1]?.focus(); // typing advances (SRC-37, SRC-Q04)
  }

  const facets = (
    <div className="search-facets">
      <fieldset className="flex flex-col gap-1">
        <legend className="label-caps mb-1">{t("facetKind")}</legend>
        {KINDS.map((k) => (
          <label key={k} className="facet-row">
            <input type="checkbox" checked={kinds[k]} onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })} />
            <span className="flex-1">{t(`kind_${k}`)}</span>
            <span className="mono text-[11px] text-t3">{formatNumber(counts[k], locale)}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="label-caps mb-1">{t("facetSource")}</legend>
        <label className="facet-row">
          <input type="checkbox" checked={kinds.verses} onChange={(e) => setKinds({ ...kinds, verses: e.target.checked })} />
          <span className="flex-1">{t("sourceQuran")}</span>
          <span className="mono text-[11px] text-t3">{formatNumber(counts.verses, locale)}</span>
        </label>
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
              placeholder="·"
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
        <span className={"detect-pill" + (detected?.kind === "root" ? " is-root" : "")}>{detected ? (locale === "ar" ? detected.label_ar : detected.label_en) : "—"}</span>
        <span className="text-t3">{detected ? (DETECT_NOTE[detected.kind] ? t(DETECT_NOTE[detected.kind]) : "") : t("typeQuery")}</span>
        {exactHref && (
          <Link href={exactHref} className="btn ms-auto min-h-[32px]">
            {t("goToVerse", { ref: exact!.key })}
          </Link>
        )}
      </div>
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
          {kinds.verses && verseRows.length > 0 && (
            <ResultGroup title={t("sectionVerses")} n={verseRows.length}>
              <ul className="flex flex-col gap-2">
                {verseRows.slice(0, 20).map(({ verse: v, highlight, trans }) => (
                  <li key={v.key}>
                    <Link href={`/quran/${v.surah}/${v.ayah}`} className="result-row is-verse">
                      <span className="dot" style={{ background: "var(--c-sentence)" }} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="ar-classical text-[17px] leading-[1.9] text-t1" lang="ar" dir="rtl">
                          {highlight ? <Highlight text={highlight} /> : v.text_imlaei}
                        </span>
                        {trans && locale === "en" && <span className="truncate text-[12px] text-t2" lang="en" dir="ltr"><Highlight text={trans} /></span>}
                      </span>
                      <span className="mono shrink-0 text-[11px] text-t3" dir="ltr">{`${v.key}`}</span>
                      <span className="shrink-0 text-[11.5px] text-t3">{v.name_ar}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultGroup>
          )}
          {kinds.words && words.length > 0 && (
            <ResultGroup title={t("sectionLemmas")} n={words.length}>
              <ul className="result-grid">
                {words.slice(0, 12).map((l) => (
                  <li key={l.id}>
                    <Link href={l.slug ? `/read?w=${encodeURIComponent(l.slug)}` : `/search?q=${encodeURIComponent(l.ar)}`} className="result-row">
                      <span className="dot" style={{ background: "var(--c-word)" }} />
                      <span className="ar-classical min-w-[80px] text-[20px] text-word" lang="ar" dir="rtl">{l.ar}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-t2">
                        {[l.envelope?.translit, locale === "ar" ? l.pos_label?.ar : (l.gloss_en ?? l.senses_en?.[0])].filter(Boolean).join(" · ")}
                      </span>
                      {l.root_spaced && <span className="ar-classical shrink-0 text-[15px] text-root" lang="ar">{l.root_spaced}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
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
            <ResultGroup title={t("sectionRoots")} n={roots.length} link={{ href: "/concordance", label: t("concordanceLink") }}>
              <ul className="result-grid">
                {roots.slice(0, lettered && !r ? 60 : 6).map((x) => (
                  <li key={x.key}>
                    <Link href={`/concordance?root=${encodeURIComponent(x.key)}`} className="result-row">
                      <span className="dot" style={{ background: "var(--c-root)" }} />
                      <span className="ar-classical min-w-[80px] text-[20px] tracking-[.06em] text-root" lang="ar" dir="rtl">{x.spaced}</span>
                      <span className="mono min-w-0 flex-1 truncate text-[11.5px] text-t3" dir="ltr">{x.translit}</span>
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
                    <Link href={`/search?q=${encodeURIComponent(p.ar.full)}`} className="result-row">
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
        </div>
      </div>
    </div>
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
