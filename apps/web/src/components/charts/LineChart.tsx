"use client";

import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import { useLocale } from "next-intl";
import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { useTip } from "./Figure";

const W = 640;
const H = 240;
const P = { top: 26, right: 16, bottom: 40, left: 52 };

/**
 * One series as a 2px line (P16): optional log axes for a rank–frequency curve, hairline grid, and a crosshair that
 * snaps to the nearest point and names it. Time and rank run left to right in both languages — an axis of numbers is
 * read so in Arabic too; the labels take the reader's digits.
 */
export function LineChart({ points, logX = false, logY = false, xLabel, yLabel, label, hue = "var(--chart-root)", format }: { points: [number, number][]; logX?: boolean; logY?: boolean; xLabel: string; yLabel: string; label: string; hue?: string; format?: (y: number) => string }) {
  const locale = useLocale();
  const tip = useTip();
  const [at, setAt] = useState<number | null>(null);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = (logX ? scaleLog() : scaleLinear()).domain([Math.max(logX ? 1 : 0, Math.min(...xs)), Math.max(...xs)]).range([P.left, W - P.right]);
  const y = (logY ? scaleLog() : scaleLinear()).domain([Math.max(logY ? 1 : 0, Math.min(...ys)), Math.max(...ys)]).range([H - P.bottom, P.top]);
  const d = line<[number, number]>().x((p) => x(p[0])).y((p) => y(Math.max(logY ? 1 : -Infinity, p[1])))(points) ?? "";
  const fmt = format ?? ((v: number) => formatNumber(v, locale));
  const xt = logX ? [1, 10, 100, 1000, 10000].filter((v) => v <= Math.max(...xs)) : x.ticks(5);
  const yt = logY ? [1, 10, 100, 1000, 10000].filter((v) => v <= Math.max(...ys)) : y.ticks(4);
  return (
    <div className="relative" dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={label}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const v = x.invert(px);
          let best = 0;
          for (let i = 1; i < points.length; i++) if (Math.abs(points[i][0] - v) < Math.abs(points[best][0] - v)) best = i;
          setAt(best);
          tip.show(e, [fmt(points[best][1]), `${xLabel}: ${formatNumber(points[best][0], locale)}`]);
        }}
        onPointerLeave={() => {
          setAt(null);
          tip.hide();
        }}
      >
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line x1={P.left} x2={W - P.right} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={P.left - 6} y={y(v) + 3} textAnchor="end" className="chart-axis">{fmt(v)}</text>
          </g>
        ))}
        {xt.map((v) => (
          <text key={`x${v}`} x={x(v)} y={H - P.bottom + 14} textAnchor="middle" className="chart-axis">{formatNumber(v, locale)}</text>
        ))}
        <path d={d} fill="none" stroke={hue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {at !== null && (
          <>
            <line x1={x(points[at][0])} x2={x(points[at][0])} y1={P.top} y2={H - P.bottom} stroke="var(--line-2)" />
            <circle cx={x(points[at][0])} cy={y(Math.max(logY ? 1 : -Infinity, points[at][1]))} r={4} fill={hue} stroke="var(--card)" strokeWidth={2} />
          </>
        )}
        <text x={(P.left + W - P.right) / 2} y={H - 4} textAnchor="middle" className="chart-axis">{xLabel}</text>
        <text x={P.left} y={12} textAnchor="start" className="chart-axis">{yLabel}</text>
      </svg>
      {tip.layer}
    </div>
  );
}
