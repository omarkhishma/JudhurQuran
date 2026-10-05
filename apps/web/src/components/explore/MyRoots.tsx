"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { cnt, formatNumber } from "@/lib/format";
import { encodeSeed } from "@/lib/graph/seedCodec";
import { getJSON } from "@/lib/reader/api";
import { usePersonal } from "@/lib/reader/store";

const DAY = 86_400_000;
const W = 640;
const H = 180;
// the count's labels on the side a line of text starts from: the left in English, the right in Arabic
const PAD = { top: 14, end: 16, bottom: 26, start: 40 };
const MAP_ROOTS = 40;

/** A root's key as its letters, spaced (علم → ع ل م). */
const spaced = (key: string) => [...key].join(" ");

/**
 * My roots (B16): the roots the reader has looked up, each kept with the day it was first met (in this browser, with
 * the journal when it syncs) — how many of the Quran's, a line of how the count grew, by day or by week, with nothing
 * lost for a day not read (no streak), the latest met, and the way to open them as a map. The line's numbers are a
 * table too.
 */
export function MyRoots() {
  const t = useTranslations("explore");
  const locale = useLocale();
  const client = useIsClient();
  const rootsMet = usePersonal((s) => s.rootsMet);
  const meta = useQuery({ queryKey: ["meta"], queryFn: () => getJSON<{ dataset: { counts: { roots: number } } }>("/meta"), staleTime: Infinity });
  const [hover, setHover] = useState<number | null>(null);
  const met = useMemo(() => Object.entries(client ? (rootsMet ?? {}) : {}).sort((a, b) => a[1] - b[1]), [rootsMet, client]);
  // the count by day (by week past two months), cumulative — the line never falls; from the first root met to the
  // last, so a pause in reading draws nothing
  const points = useMemo(() => {
    if (!met.length) return [];
    const start = new Date(met[0][1]);
    start.setHours(0, 0, 0, 0);
    const span = met[met.length - 1][1] - start.getTime();
    const step = span > 60 * DAY ? 7 * DAY : DAY;
    // one point a day (or week) from the first root's to the last's
    const n = Math.floor(span / step) + 1;
    const out: { at: number; count: number }[] = [];
    let i = 0;
    for (let k = 0; k < n; k++) {
      const end = start.getTime() + (k + 1) * step;
      while (i < met.length && met[i][1] < end) i++;
      out.push({ at: start.getTime() + k * step, count: i });
    }
    return out;
  }, [met]);
  if (!client || !met.length) return null;
  const total = meta.data?.dataset.counts.roots;
  const last = points[points.length - 1];
  const max = Math.max(1, last.count);
  // time runs the way the page reads: left to right in English, right to left in Arabic
  const rtl = locale === "ar";
  const plot = W - PAD.start - PAD.end;
  const x = (k: number) => {
    const f = points.length === 1 ? 0 : k / (points.length - 1);
    return rtl ? W - PAD.start - f * plot : PAD.start + f * plot;
  };
  const labelX = rtl ? W - PAD.start + 6 : PAD.start - 6;
  const labelAnchor = rtl ? "start" : "end";
  const y = (c: number) => PAD.top + (1 - c / max) * (H - PAD.top - PAD.bottom);
  const line = points.map((p, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(p.count).toFixed(1)}`).join(" ");
  const day = (ms: number) => new Date(ms).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short" });
  const latest = [...met].reverse().slice(0, 12);
  const seed = encodeSeed({ seed: "set", name: t("myRootsMap"), steps: [...met].reverse().slice(0, MAP_ROOTS).map(([key]) => ({ kind: "root" as const, id: key })) });
  const shown = hover ?? points.length - 1;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="explore-my-roots">
      <div>
        <h2 id="explore-my-roots" className="text-[15px] font-semibold">{t("myRoots")}</h2>
        <p className="max-w-[720px] text-[12.5px] leading-relaxed text-t3">{t("myRootsSub")}</p>
      </div>
      <div className="my-roots">
        <div className="flex flex-col gap-2">
          <p className="text-[26px] font-semibold leading-tight">
            {total ? t("myRootsCount", { roots: t("roots", cnt(met.length, locale)), of: formatNumber(total, locale) }) : t("roots", cnt(met.length, locale))}
          </p>
          <figure className="my-roots-chart">
            {/* the drawing's coordinates run left to right in either language, so its anchors mean what they say there */}
            <svg viewBox={`0 0 ${W} ${H}`} style={{ direction: "ltr" }} role="img" aria-label={t("myRootsChart", { n: formatNumber(last.count, locale), since: day(points[0].at) })} onPointerLeave={() => setHover(null)}>
              {/* the axis: the count at the top and at nought, quiet */}
              <line x1={x(0)} x2={x(points.length - 1)} y1={y(0)} y2={y(0)} className="chart-axis" />
              <line x1={x(0)} x2={x(points.length - 1)} y1={y(max)} y2={y(max)} className="chart-grid" />
              <text x={labelX} y={y(max) + 4} textAnchor={labelAnchor} className="chart-tick">{formatNumber(max, locale)}</text>
              <text x={labelX} y={y(0) + 4} textAnchor={labelAnchor} className="chart-tick">{formatNumber(0, locale)}</text>
              <text x={x(0)} y={H - 6} textAnchor={rtl ? "end" : "start"} className="chart-tick">{day(points[0].at)}</text>
              <text x={x(points.length - 1)} y={H - 6} textAnchor={rtl ? "start" : "end"} className="chart-tick">{day(last.at)}</text>
              <path d={`${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} className="chart-area" />
              <path d={line} className="chart-line" />
              <line x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={y(0)} className="chart-cross" />
              <circle cx={x(shown)} cy={y(points[shown].count)} r={4.5} className="chart-dot" />
              {/* a hit area per point, wider than the mark */}
              {points.map((p, k) => {
                const band = plot / Math.max(1, points.length - 1);
                return <rect key={k} x={x(k) - band / 2} y={0} width={band} height={H} fill="transparent" onPointerEnter={() => setHover(k)} />;
              })}
            </svg>
            <figcaption className="text-[12px] text-t2" aria-live="polite">{t("myRootsAt", { n: formatNumber(points[shown].count, locale), date: day(points[shown].at) })}</figcaption>
          </figure>
          <details className="text-[12px]">
            <summary className="cursor-pointer text-t2">{t("myRootsTable")}</summary>
            <table className="mt-2 w-full max-w-[360px] text-[12px]">
              <thead>
                <tr className="text-t3">
                  <th scope="col" className="text-start font-medium">{t("myRootsDate")}</th>
                  <th scope="col" className="text-end font-medium">{t("myRootsSoFar")}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.at} className="border-t border-line">
                    <th scope="row" className="text-start font-normal">{day(p.at)}</th>
                    <td className="text-end">{formatNumber(p.count, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
        <div className="flex flex-col gap-2">
          <p className="label-caps">{t("myRootsLatest")}</p>
          <ul className="flex flex-wrap gap-1.5">
            {latest.map(([key]) => (
              <li key={key}>
                <Link href={`/roots/${encodeURIComponent(key)}`} prefetch={false} className="root-chip" lang="ar">{spaced(key)}</Link>
              </li>
            ))}
          </ul>
          <Link href={`/graph/seed?s=${seed}`} className="btn self-start">{t("myRootsOpenMap", { n: formatNumber(Math.min(MAP_ROOTS, met.length), locale) })}</Link>
          <p className="text-[11.5px] text-t3">{t("myRootsKept")}</p>
        </div>
      </div>
    </section>
  );
}
