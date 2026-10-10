"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { BarList } from "@/components/charts/BarList";
import { Figure, RampKey } from "@/components/charts/Figure";
import { Heatmap } from "@/components/charts/Heatmap";
import { LineChart } from "@/components/charts/LineChart";
import { SurahColumns } from "@/components/charts/SurahColumns";
import { Link, useRouter } from "@/i18n/navigation";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { Frequency, MatrixData, Overview, RankFrequency, SurahProfile } from "@/lib/stats";

const pct = (x: number, locale: string, digits = 1) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent", maximumFractionDigits: digits }).format(x);
type Kind = Frequency["kind"];
type Place = "" | "meccan" | "medinan";
const METRICS = ["words", "verses", "words_per_verse", "roots", "unique_roots", "hapax"] as const;
type Metric = (typeof METRICS)[number];

/**
 * The Quran in numbers (P16, PV-12, PV-13, PV-15, PV-16): the headline counts; the most frequent roots, words,
 * patterns or parts of speech in the Quran or its Meccan or Medinan sūras; each sūra's size and vocabulary as columns
 * in the mushaf's order or the order of revelation; the most frequent roots across the sūras as a heatmap; how few
 * words make up most of the text. Descriptive only (L4): each chart says what it counted.
 */
export function StatsScreen({ overview, frequency, surahs, matrix, rank }: { overview: Overview; frequency: Frequency; surahs: SurahProfile[]; matrix: MatrixData; rank: RankFrequency }) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const n = (x: number) => formatNumber(x, locale);
  const [kind, setKind] = useState<Kind>("root");
  const [place, setPlace] = useState<Place>("");
  const [content, setContent] = useState(true);
  const [metric, setMetric] = useState<Metric>("words");
  const [order, setOrder] = useState<"mushaf" | "revelation">("mushaf");
  const freq = useQuery({
    queryKey: ["stats-frequency", kind, place, content],
    queryFn: () => getJSON<Frequency>(`/stats/frequency?kind=${kind}&limit=30&content=${content}${place ? `&place=${place}` : ""}`),
    initialData: kind === "root" && !place && content ? frequency : undefined,
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });
  const o = overview;
  const f = freq.data ?? frequency;
  const name = (s: { name_ar: string; name_translit: string }) => (ar ? s.name_ar : s.name_translit);
  // a hundred, a thousand: how much of the text the most frequent words make up
  const share = (k: number) => rank.cumulative[Math.min(k, rank.cumulative.length) - 1];
  const ranks: [number, number][] = rank.counts.map((c, i) => [i + 1, c]);
  const sampled = ranks.filter(([r]) => r <= 20 || r % Math.max(1, Math.floor(r / 20)) === 0);

  const tile = (label: string, value: string, sub?: string) => (
    <div className="dash-tile">
      <span className="text-[12px] text-t2">{label}</span>
      <span className="text-[24px] font-semibold leading-tight text-t1">{value}</span>
      {sub && <span className="text-[11.5px] text-t3">{sub}</span>}
    </div>
  );
  const seg = <T extends string>(value: T, set: (v: T) => void, opts: [T, string][], label: string) => (
    <div className="seg-group" role="group" aria-label={label}>
      {opts.map(([v, l]) => (
        <button key={v} type="button" className={"seg" + (value === v ? " is-on" : "")} aria-pressed={value === v} onClick={() => set(v)}>
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="dash-kpis" aria-label={t("overview")}>
        {tile(t("words"), n(o.words), t("wordsSub", { roots: n(o.words_with_root) }))}
        {tile(t("verses"), n(o.verses), t("versesSub", { mean: n(o.mean_words_per_verse) }))}
        {tile(t("lemmas"), n(o.lemmas), t("lemmasSub", { hapax: n(o.hapax_lemmas) }))}
        {tile(t("roots"), n(o.roots), t("rootsSub", { hapax: n(o.hapax_roots) }))}
        {tile(t("patterns"), n(o.patterns))}
        {tile(t("place"), `${n(o.place.meccan.surahs)} • ${n(o.place.medinan.surahs)}`, t("placeSub", { meccan: n(o.place.meccan.words), medinan: n(o.place.medinan.words) }))}
      </section>
      <p className="text-[12.5px] leading-relaxed text-t2">
        {t("facts", {
          verse: verseRef(o.longest_verse.key, locale),
          verseWords: n(o.longest_verse.words),
          root: o.top_root.spaced,
          rootCount: n(o.top_root.count),
          lemma: o.top_lemma.ar,
          lemmaCount: n(o.top_lemma.count),
        })}
      </p>

      <Figure
        id="freq"
        title={t("freqTitle")}
        caption={t("freqCaption", { total: n(f.total_words), distinct: n(f.distinct) })}
        legend={
          <div className="flex flex-wrap items-center gap-2">
            {seg<Kind>(kind, setKind, [["root", t("kindRoot")], ["lemma", t("kindLemma")], ["pattern", t("kindPattern")], ["pos", t("kindPos")]], t("kind"))}
            {seg<Place>(place, setPlace, [["", t("all")], ["meccan", t("meccan")], ["medinan", t("medinan")]], t("place"))}
            <label className="flex items-center gap-1.5 text-[12px] text-t2">
              <input type="checkbox" checked={content} onChange={(e) => setContent(e.target.checked)} />
              {t("contentOnly")}
            </label>
          </div>
        }
      >
        <div className={freq.isFetching ? "opacity-60" : undefined}>
          <BarList
            hue={kind === "root" ? "var(--chart-root)" : kind === "pattern" ? "var(--c-form)" : "var(--c-word)"}
            format={(v) => `${n(v)} • ${pct(v / f.total_words, locale)}`}
            items={f.items.map((it) => ({
              key: it.key ?? it.slug ?? it.tag ?? "",
              value: it.count,
              href: kind === "root" ? `/roots/${encodeURIComponent(it.key!)}` : kind === "lemma" ? `/quran/1?w=${encodeURIComponent(it.slug!)}` : undefined,
              label:
                kind === "root" ? (
                  <span className="ar-classical text-[15px]" lang="ar">{it.spaced}</span>
                ) : kind === "pos" ? (
                  ar ? it.ar : it.en
                ) : (
                  <span className="ar-classical text-[15px]" lang="ar">{it.ar}</span>
                ),
            }))}
          />
        </div>
      </Figure>

      <Figure
        id="sizes"
        title={t("sizesTitle")}
        caption={t(`metric_${metric}_caption`)}
        legend={
          <div className="flex flex-wrap items-center gap-2">
            {seg<Metric>(metric, setMetric, METRICS.map((m) => [m, t(`metric_${m}`)]), t("metric"))}
            {seg<"mushaf" | "revelation">(order, setOrder, [["mushaf", t("orderMushaf")], ["revelation", t("orderRevelation")]], t("order"))}
          </div>
        }
        table={
          <table>
            <thead>
              <tr>
                <th scope="col">{t("surah")}</th>
                <th scope="col" className="num">{t("revelationOrder")}</th>
                {METRICS.map((m) => (
                  <th key={m} scope="col" className="num">{t(`metric_${m}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {surahs.map((s) => (
                <tr key={s.surah}>
                  <th scope="row">
                    <Link href={`/stats/surah/${s.surah}`} prefetch={false} className="hover:underline">{`${n(s.surah)}. ${name(s)}`}</Link>
                  </th>
                  <td className="num">{n(s.revelation_order)}</td>
                  {METRICS.map((m) => (
                    <td key={m} className="num">{n(s[m])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <SurahColumns
          label={t("sizesTitle")}
          by={order === "mushaf" ? "mushaf" : "revelation"}
          data={surahs.map((s) => ({ surah: s.surah, name: name(s), place: s.place, order: s.revelation_order, value: s[metric] }))}
          onPick={(s) => router.push(`/stats/surah/${s}`)}
        />
      </Figure>

      <Figure
        id="heat"
        title={t("heatTitle", { n: n(matrix.roots.length) })}
        caption={t("heatCaption")}
        legend={<RampKey hue="var(--chart-root)" low={t("none")} high={t("most")} />}
        table={
          <table>
            <thead>
              <tr>
                <th scope="col">{t("root")}</th>
                <th scope="col" className="num">{t("total")}</th>
                <th scope="col">{t("surahsMost")}</th>
              </tr>
            </thead>
            <tbody>
              {matrix.roots.map((r, i) => {
                const best = matrix.counts[i].map((v, j) => [v, j] as const).sort((a, b) => b[0] - a[0]).slice(0, 3);
                return (
                  <tr key={r.key}>
                    <th scope="row" lang="ar">{r.spaced}</th>
                    <td className="num">{n(r.total)}</td>
                    <td>{best.map(([v, j]) => `${name(matrix.surahs[j])} ${n(v)}`).join("، ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        }
      >
        <Heatmap
          label={t("heatTitle", { n: n(matrix.roots.length) })}
          columns={matrix.surahs.map((s) => `${n(s.surah)}. ${name(s)}`)}
          rows={matrix.roots.map((r, i) => ({ key: r.key, label: r.spaced, values: matrix.counts[i] }))}
          perRow
          onCell={(i) => router.push(`/roots/${encodeURIComponent(matrix.roots[i].key)}`)}
        />
      </Figure>

      <Figure id="rank" title={t("rankTitle")} caption={t("rankCaption", { top100: pct(share(100), locale), top1000: pct(share(1000), locale), lemmas: n(rank.counts.length) })}>
        <LineChart points={sampled} logX logY xLabel={t("rank")} yLabel={t("count")} label={t("rankTitle")} />
      </Figure>

      <nav className="flex flex-wrap gap-2" aria-label={t("more")}>
        <Link href="/stats/relations" className="btn">{t("toRelations")}</Link>
        <Link href={`/stats/surah/${o.longest_surah.surah}`} className="btn">{t("toSurah", { name: name(o.longest_surah) })}</Link>
      </nav>
      <p className="text-[11.5px] text-t3">{t("method", cnt(o.words, locale))}</p>
    </div>
  );
}
