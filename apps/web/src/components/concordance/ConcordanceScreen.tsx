"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { Link } from "@/i18n/navigation";
import { useAfterMount } from "@/lib/client";
import { cnt, cnt2, formatNumber, verseRef } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { usePersonal, usePrefs } from "@/lib/reader/store";
import { type ConcordancePage, concordanceQuery, DEFAULT_ROOT, type Filters } from "@/lib/concordance";

type Dist = {
  total: number;
  per_surah: { surah: number; name_ar: string; name_translit: string; place: string; revelation_order: number; hits: number; words: number; per100: number }[];
  place: { meccan: number; medinan: number };
  forms: { form: string; n: number }[];
  collocates: { slug: string; ar: string; n: number }[];
};
type RootRow = { key: string; spaced: string; translit: string; occurrences: number };

const CLEARED = { lemma: "", pattern: "", surah: "", surah_to: "", juz: "", juz_to: "", pos: "", form: "", near: "" };

const SEED_ROOTS = ["علم", "رحم", "كتب", "قرأ", "صبر", "هدي", "ذكر", "نور"];
// The chapters of a root index in the order of the Arabic dictionaries; the hamza chapter is shown as أ.
const LETTERS = ["ء", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"];
const MECCAN = "var(--chart-root)";
const MEDINAN = "var(--c-sentence)";

/** The root the reader was last on (the trail), when the concordance is opened with none (CON-05). */
function useContextRoot(enabled: boolean) {
  return useQuery({
    queryKey: ["concordance-context"],
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      // the reading context first (RDR-441), then the trail
      const ctx = usePersonal.getState().context;
      if (ctx?.root) return ctx.root;
      const trail = usePersonal.getState().trail;
      for (let i = trail.length - 1; i >= 0; i--) {
        const s = trail[i];
        if (s.kind === "root") return s.id;
        if (s.kind === "word") {
          const w = await getJSON<{ root: { key: string } | null }>(`/words/${encodeURIComponent(s.id)}?limit=0`).catch(() => null);
          if (w?.root) return w.root.key;
        }
      }
      return null;
    },
  });
}

/**
 * The concordance (design 05 §5.3, CON-01…39 with the Quran notes CON-Q01…Q09): every occurrence of a
 * root as KWIC lines that hug the keyword (preceding on its right, following on its left), mushaf order
 * by default with following/preceding sorts; filters by word, pattern, part of speech, sūra, juzʾ,
 * Makki/Madani, surface form and a nearby word; a distribution view per sūra (mushaf or revelation
 * order) with forms and collocates that filter the lines; an alphabetical root index; CSV export — all
 * kept in the URL.
 */
export function ConcordanceScreen({ initial, initialPage, initialTr }: { initial: Filters; initialPage: ConcordancePage | null; initialTr: string }) {
  const t = useTranslations("concordance");
  const locale = useLocale();
  const [f, setF] = useState<Filters>(initial);
  const set = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));
  const [indexOpen, setIndexOpen] = useState(false);
  const mounted = useAfterMount();
  const trPref = usePrefs((s) => s.translation);
  const tr = mounted ? trPref : initialTr;
  const ctx = useContextRoot(!initial.root);
  const root = f.root || ctx.data || DEFAULT_ROOT;
  const view = f.view === "dist" ? "dist" : "kwic";
  const sort = f.sort || "mushaf";

  useEffect(() => {
    const url = new URL(window.location.href);
    const shown: Record<string, string> = { ...f, root: f.root || (ctx.data ?? "") };
    url.searchParams.delete("w");
    for (const [k, v] of Object.entries(shown)) {
      if (v && !(k === "sort" && v === "mushaf") && !(k === "view" && v === "kwic")) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url.href);
  }, [f, ctx.data]);

  // English readers get each line's verse in their translation as the row's tooltip (CON-08).
  const lineTr = locale === "ar" ? "" : tr;
  const qs = concordanceQuery(root, f, { sort, limit: "60", tr: lineTr });
  const key = qs.toString();
  const initialKey = initialPage ? concordanceQuery(initial.root || DEFAULT_ROOT, initial, { sort: initial.sort || "mushaf", limit: "60", tr: locale === "ar" ? "" : initialTr }).toString() : null;
  const lines = useInfiniteQuery({
    queryKey: ["concordance", key],
    queryFn: ({ pageParam }) => getJSON<ConcordancePage>(`/concordance?${key}&offset=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last) => last.next_offset ?? undefined,
    initialData: key === initialKey && initialPage ? { pages: [initialPage], pageParams: [0] } : undefined,
  });
  const distQs = concordanceQuery(root, { ...f, surah: "", surah_to: "" }).toString();
  const dist = useQuery({
    queryKey: ["concordance-dist", distQs],
    queryFn: () => getJSON<Dist>(`/concordance/distribution?${distQs}`),
    enabled: view === "dist",
  });
  const first = lines.data?.pages[0];
  const rows = lines.data?.pages.flatMap((p) => p.data) ?? [];
  const csvHref = `/api/v1/concordance.csv?${concordanceQuery(root, f, { sort, tr }).toString()}`;
  const pickRoot = (k: string) => {
    set({ root: k, ...CLEARED });
    setIndexOpen(false);
  };
  const nearLabel = (slug: string) => first?.filters.near_ar ?? dist.data?.collocates.find((c) => c.slug === slug)?.ar ?? slug;

  return (
    <div className="conc-screen">
      <div className="conc-top">
        <h1 className="text-[20px] font-semibold">{t("title")}</h1>
        <span className="flex-1" />
        <Segmented
          label={t("view")}
          value={view}
          onChange={(v) => set({ view: v })}
          options={[
            { value: "kwic", label: t("viewKwic") },
            { value: "dist", label: t("viewDist") },
          ]}
        />
        <a className="btn" href={csvHref} download>
          {t("exportCsv")}
        </a>
      </div>

      <div className="conc-filters">
        <div className="conc-roots" role="group" aria-label={t("root")}>
          <span className="label-caps">{t("root")}</span>
          {[...new Set([root, ...SEED_ROOTS])].map((k) => (
            <button key={k} type="button" className={"root-pill" + (k === root ? " is-on" : "")} aria-pressed={k === root} onClick={() => pickRoot(k)} lang="ar">
              {k.split("").join(" ")}
            </button>
          ))}
        </div>
        <button type="button" className="chip" aria-expanded={indexOpen} aria-controls="conc-index" onClick={() => setIndexOpen((o) => !o)}>
          {t("rootIndex")}
        </button>
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get("r")?.toString().replace(/[\s\-ـ]/g, "") ?? "";
            if (v) pickRoot(v);
          }}
        >
          <input name="r" className="conc-root-input" placeholder={t("otherRoot")} aria-label={t("otherRoot")} lang="ar" dir="auto" />
        </form>
        <span className="flex-1" />
        {first && (
          <span className="mono text-[12px] text-t3">
            {t("metaHits", cnt(first.total, locale))} · <bdi dir="ltr">{first.root.translit}</bdi> · {t("metaWords", cnt(first.facets.lemmas.length, locale))}
          </span>
        )}
      </div>

      {indexOpen && <RootIndex current={root} onPick={pickRoot} />}

      {first && (
        <div className="conc-subbar">
          <div className="conc-subrow">
            {view === "kwic" && (
              <Segmented
                label={t("sort")}
                value={sort}
                onChange={(v) => set({ sort: v })}
                options={[
                  { value: "mushaf", label: t("sortMushaf") },
                  { value: "preceding", label: t("sortPreceding") },
                  { value: "following", label: t("sortFollowing") },
                ]}
              />
            )}
            <Segmented
              label={t("place")}
              value={f.place || "all"}
              onChange={(v) => set({ place: v === "all" ? "" : v })}
              options={[
                { value: "all", label: t("placeAll") },
                { value: "meccan", label: t("meccan") },
                { value: "medinan", label: t("medinan") },
              ]}
            />
            <label className="conc-select">
              <span>{t("surah")}</span>
              <select value={f.surah} onChange={(e) => set({ surah: e.target.value, surah_to: "" })}>
                <option value="">{t("allSurahs")}</option>
                {first.facets.surahs.map((s) => (
                  <option key={s.surah} value={s.surah}>{`${formatNumber(s.surah, locale)}. ${locale === "ar" ? s.name_ar : s.name_translit} (${formatNumber(s.n, locale)})`}</option>
                ))}
              </select>
            </label>
            {/* a range of sūras: the end, from the sūras after the start where the root occurs (CON-Q03) */}
            {f.surah && (
              <label className="conc-select">
                <span>{t("rangeTo")}</span>
                <select value={f.surah_to} onChange={(e) => set({ surah_to: e.target.value })} aria-label={t("surahTo")}>
                  <option value="">{t("rangeNone")}</option>
                  {first.facets.surahs
                    .filter((s) => s.surah > Number(f.surah))
                    .map((s) => (
                      <option key={s.surah} value={s.surah}>{`${formatNumber(s.surah, locale)}. ${locale === "ar" ? s.name_ar : s.name_translit}`}</option>
                    ))}
                </select>
              </label>
            )}
            <label className="conc-select">
              <span>{t("juz")}</span>
              <select value={f.juz} onChange={(e) => set({ juz: e.target.value, juz_to: "" })}>
                <option value="">{t("allJuz")}</option>
                {first.facets.juz.map((j) => (
                  <option key={j.juz} value={j.juz}>{`${formatNumber(j.juz, locale)} (${formatNumber(j.n, locale)})`}</option>
                ))}
              </select>
            </label>
            {f.juz && (
              <label className="conc-select">
                <span>{t("rangeTo")}</span>
                <select value={f.juz_to} onChange={(e) => set({ juz_to: e.target.value })} aria-label={t("juzTo")}>
                  <option value="">{t("rangeNone")}</option>
                  {first.facets.juz
                    .filter((j) => j.juz > Number(f.juz))
                    .map((j) => (
                      <option key={j.juz} value={j.juz}>{formatNumber(j.juz, locale)}</option>
                    ))}
                </select>
              </label>
            )}
          </div>
          <ChipRow
            label={t("pos")}
            anyLabel={t("anyN", { n: formatNumber(first.root.occurrences, locale) })}
            value={f.pos}
            onChange={(pos) => set({ pos })}
            items={first.facets.pos.map((p) => ({ value: p.tag, label: locale === "ar" ? p.ar : p.en, n: p.n }))}
          />
          <ChipRow
            label={t("word")}
            anyLabel={t("anyN", { n: formatNumber(first.root.occurrences, locale) })}
            value={f.lemma}
            onChange={(lemma) => set({ lemma })}
            items={first.facets.lemmas.map((l) => ({ value: l.slug, label: l.ar, n: l.n, ar: true }))}
          />
          <ChipRow
            label={t("pattern")}
            anyLabel={t("any")}
            value={f.pattern}
            onChange={(pattern) => set({ pattern })}
            items={first.facets.patterns.map((p) => ({ value: p.slug, label: p.ar, n: p.n, ar: true }))}
          />
          {(f.form || f.near) && (
            <div className="conc-subrow">
              {f.form && (
                <button type="button" className="chip is-on" onClick={() => set({ form: "" })} aria-label={t("clearForm", { form: f.form })}>
                  {t("formIs")} <span className="ar-classical text-[15px]" lang="ar">{f.form}</span> <span aria-hidden>×</span>
                </button>
              )}
              {f.near && (
                <button type="button" className="chip is-on" onClick={() => set({ near: "" })} aria-label={t("clearNear", { word: nearLabel(f.near) })}>
                  {t("nearIs")} <span className="ar-classical text-[15px]" lang="ar">{nearLabel(f.near)}</span> <span aria-hidden>×</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {lines.isError && <p className="text-[13px] text-bad" role="alert">{t("notFound")}</p>}

      {view === "kwic" ? (
        // the lines read right to left in both interface languages: source · preceding · keyword · following
        <div className="conc-kwic" dir="rtl">
          <div className="conc-head" aria-hidden>
            <span>{t("colSource")}</span>
            <span className="conc-head-pre">
              <span>→</span>
              <span>{t("colPreceding")}</span>
            </span>
            <span className="text-center">{t("colKeyword")}</span>
            <span className="conc-head-fol">
              <span>{t("colFollowing")}</span>
              <span>←</span>
            </span>
          </div>
          {lines.isLoading && [0, 1, 2, 3, 4].map((i) => <div key={i} className="h-10 animate-pulse rounded-md bg-card-2" />)}
          <ol className="conc-lines" aria-label={t("viewKwic")}>
            {rows.map((x) => (
              <li key={x.location}>
                <Link
                  href={`/quran/${x.surah}?${x.lemma_slug ? `w=${encodeURIComponent(x.lemma_slug)}&` : ""}at=${x.location}#v${x.ayah}`}
                  className="conc-row"
                  title={(locale === "ar" ? [x.lemma, x.pattern] : [x.translation]).filter(Boolean).join(" · ") || undefined}
                  data-loc={x.location}
                >
                  <span className="conc-src">
                    <span className="mono" dir="ltr">{verseRef(x.verse_key, locale)}</span>
                    <span className="truncate text-t3" lang={locale === "ar" ? "ar" : "en"}>{locale === "ar" ? x.surah_name_ar : x.surah_name_translit}</span>
                  </span>
                  <span className="conc-pre quran" lang="ar"><bdi>{x.left || "—"}</bdi></span>
                  <span className="conc-key quran" lang="ar"><bdi>{x.keyword}</bdi></span>
                  <span className="conc-fol quran" lang="ar"><bdi>{x.right || "—"}</bdi></span>
                </Link>
              </li>
            ))}
          </ol>
          {first && first.total === 0 && <p className="p-4 text-[13px] text-t3">{t("empty")}</p>}
          {lines.hasNextPage && (
            <button type="button" className="btn justify-self-center" onClick={() => lines.fetchNextPage()} disabled={lines.isFetchingNextPage}>
              {t("more", { shown: formatNumber(rows.length, locale), total: formatNumber(first?.total ?? 0, locale) })}
            </button>
          )}
          <p className="text-[11.5px] text-t3" dir={locale === "ar" ? "rtl" : "ltr"}>
            {t("footer")}
            {first?.translation && ` ${t("trCredit", { work: first.translation.title_en, author: first.translation.author_en })}`}
          </p>
        </div>
      ) : (
        <Distribution
          d={dist.data}
          loading={dist.isLoading}
          form={f.form}
          onForm={(form) => set({ form: form === f.form ? "" : form, view: "kwic" })}
          onSurah={(s) => set({ surah: String(s), view: "kwic" })}
          onNear={(near) => set({ near, view: "kwic" })}
        />
      )}
    </div>
  );
}

type ChipItem = { value: string; label: string; n: number; ar?: boolean };

/** One filter as a row of chips: "any" first, then each value with its count, most used first (CON-06). */
function ChipRow({ label, anyLabel, value, onChange, items }: { label: string; anyLabel: string; value: string; onChange: (v: string) => void; items: ChipItem[] }) {
  const locale = useLocale();
  return (
    <div className="conc-chips" role="group" aria-label={label}>
      <span className="label-caps">{label}</span>
      <div className="conc-chip-list">
        <button type="button" className={"chip" + (!value ? " is-on" : "")} aria-pressed={!value} onClick={() => onChange("")}>
          {anyLabel}
        </button>
        {items.map((i) => (
          <button key={i.value} type="button" className={"chip" + (value === i.value ? " is-on" : "")} aria-pressed={value === i.value} onClick={() => onChange(value === i.value ? "" : i.value)}>
            <span className={i.ar ? "ar-classical text-[15px]" : undefined} lang={i.ar ? "ar" : undefined}>{i.label}</span>
            <span className="mono text-[10.5px] text-t3">{formatNumber(i.n, locale)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** An alphabetical index of every root, chapter by first letter, in the tradition of al-Muʿjam al-Mufahras. */
function RootIndex({ current, onPick }: { current: string; onPick: (k: string) => void }) {
  const t = useTranslations("concordance");
  const locale = useLocale();
  const [letter, setLetter] = useState(() => (LETTERS.includes(current[0]) ? current[0] : "أإآ".includes(current[0]) ? "ء" : "ع"));
  const roots = useQuery({
    queryKey: ["roots-by-letter", letter],
    queryFn: () => getJSON<{ data: RootRow[]; total: number }>(`/roots?l1=${encodeURIComponent(letter)}&order=alphabetical&limit=500`),
    staleTime: Infinity,
  });
  return (
    <section id="conc-index" className="conc-index" aria-label={t("rootIndex")}>
      <div className="conc-letters" role="group" aria-label={t("letter")} dir="rtl">
        {LETTERS.map((l) => (
          <button key={l} type="button" className={"conc-letter" + (l === letter ? " is-on" : "")} aria-pressed={l === letter} onClick={() => setLetter(l)} lang="ar">
            {l === "ء" ? "أ" : l}
          </button>
        ))}
      </div>
      {roots.isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-card-2" />
      ) : (
        <ul className="conc-index-list" dir="rtl">
          {roots.data?.data.map((r) => (
            <li key={r.key}>
              <button type="button" className={"conc-index-root" + (r.key === current ? " is-on" : "")} onClick={() => onPick(r.key)}>
                <span className="ar-classical text-[18px]" lang="ar">{r.spaced}</span>
                <span className="mono text-[11px] text-t3">{formatNumber(r.occurrences, locale)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Distribution({
  d,
  loading,
  form,
  onForm,
  onSurah,
  onNear,
}: {
  d?: Dist;
  loading: boolean;
  form: string;
  onForm: (f: string) => void;
  onSurah: (s: number) => void;
  onNear: (slug: string) => void;
}) {
  const t = useTranslations("concordance");
  const locale = useLocale();
  const [order, setOrder] = useState<"mushaf" | "revelation">("mushaf");
  if (loading || !d) return <div className="h-60 animate-pulse rounded-xl bg-card-2" />;
  const maxRate = Math.max(...d.per_surah.map((s) => s.per100), 0.01);
  const maxForm = Math.max(...d.forms.map((f) => f.n), 1);
  const maxCol = Math.max(...d.collocates.map((c) => c.n), 1);
  const surahs = order === "mushaf" ? d.per_surah : [...d.per_surah].sort((a, b) => a.revelation_order - b.revelation_order);
  return (
    <div className="conc-dist">
      <section className="conc-pane" aria-label={t("bySurah")}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="label-caps flex-1">{t("bySurah")}</p>
          <Segmented
            label={t("surahOrder")}
            value={order}
            onChange={setOrder}
            options={[
              { value: "mushaf", label: t("orderMushaf") },
              { value: "revelation", label: t("orderRevelation") },
            ]}
          />
        </div>
        <p className="text-[12px] text-t3">{t("inSurahs", cnt(d.per_surah.length, locale))}</p>
        <p className="flex flex-wrap gap-x-4 text-[12px] text-t2">
          <span className="inline-flex items-center gap-1.5"><i className="dist-key" style={{ background: MECCAN }} />{t("meccanN", { n: formatNumber(d.place.meccan, locale) })}</span>
          <span className="inline-flex items-center gap-1.5"><i className="dist-key" style={{ background: MEDINAN }} />{t("medinanN", { n: formatNumber(d.place.medinan, locale) })}</span>
        </p>
        <ul className="flex flex-col">
          {surahs.map((s) => (
            <li key={s.surah}>
              <button type="button" className="dist-row" onClick={() => onSurah(s.surah)} title={t("hitsOfWords", { ...cnt(s.hits, locale), ...cnt2(s.words, locale) })}>
                <span className="w-[120px] truncate text-start text-[12.5px]">
                  {order === "revelation" && <span className="mono text-[10.5px] text-t3">{`${formatNumber(s.revelation_order, locale)} · `}</span>}
                  {`${formatNumber(s.surah, locale)}. ${locale === "ar" ? s.name_ar : s.name_translit}`}
                </span>
                <span className="dist-track"><span style={{ width: `${(s.per100 / maxRate) * 100}%`, background: s.place === "meccan" ? MECCAN : MEDINAN }} /></span>
                <span className="mono w-[86px] text-end text-[11px] text-t3">{`${formatNumber(s.hits, locale)} · ${formatNumber(s.per100, locale)}`}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-t3">{t("rateNote")}</p>
      </section>
      <section className="conc-pane" aria-label={t("byForm")}>
        <p className="label-caps">{t("byForm")}</p>
        <p className="text-[11px] text-t3">{t("byFormNote")}</p>
        <ul className="flex flex-col">
          {d.forms.slice(0, 24).map((f) => (
            <li key={f.form}>
              <button type="button" className={"dist-row" + (f.form === form ? " is-on" : "")} aria-pressed={f.form === form} onClick={() => onForm(f.form)}>
                <span className="ar-classical w-[110px] truncate text-start text-[18px]" lang="ar">{f.form}</span>
                <span className="dist-track"><span style={{ width: `${(f.n / maxForm) * 100}%`, background: "var(--c-word)" }} /></span>
                <span className="mono w-[40px] text-end text-[11px] text-t3">{formatNumber(f.n, locale)}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="label-caps mt-3">{t("collocates")}</p>
        <p className="text-[11px] text-t3">{t("collocatesNote")}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {d.collocates.map((c) => (
            <button
              key={c.slug}
              type="button"
              className="ar-classical text-t1 hover:text-word"
              lang="ar"
              style={{ fontSize: 14 + (c.n / maxCol) * 12 }}
              title={t("coOccurrences", cnt(c.n, locale))}
              onClick={() => onNear(c.slug)}
            >
              {c.ar}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
