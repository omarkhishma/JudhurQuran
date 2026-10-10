"use client";

import { scaleLinear } from "d3-scale";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { Key, useTip } from "./Figure";

export type SurahValue = { surah: number; name: string; place: "meccan" | "medinan"; order: number; value: number; extra?: string };

const W = 1140;
const H = 180;
const PAD = { top: 8, bottom: 22, side: 36 };

/**
 * One value per sūra as columns (P16): in the mushaf's order or the order of revelation, each column coloured by
 * where the sūra was revealed (a validated pair, named in the legend), a hairline axis, a tooltip on hover and on
 * focus, and a press that opens the sūra. In Arabic the first sūra stands at the right, as the text runs.
 */
export function SurahColumns({ data, by, label, onPick }: { data: SurahValue[]; by: "mushaf" | "revelation"; label: string; onPick?: (surah: number) => void }) {
  const t = useTranslations("charts");
  const locale = useLocale();
  const rtl = locale === "ar";
  const tip = useTip();
  const rows = [...data].sort((a, b) => (by === "mushaf" ? a.surah - b.surah : a.order - b.order));
  const max = Math.max(1, ...rows.map((r) => r.value));
  const y = scaleLinear().domain([0, max]).nice(4).range([H - PAD.bottom, PAD.top]);
  const step = (W - 2 * PAD.side) / rows.length;
  const bw = Math.max(2, Math.min(24, step - 2));
  const x = (i: number) => (rtl ? W - PAD.side - (i + 1) * step : PAD.side + i * step) + (step - bw) / 2;
  const ticks = y.ticks(4);
  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap gap-3">
        <Key color="var(--chart-meccan)" label={t("meccan")} />
        <Key color="var(--chart-medinan)" label={t("medinan")} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.side} x2={W - PAD.side} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={rtl ? W - 4 : 4} y={y(v) + 3} textAnchor={rtl ? "end" : "start"} className="chart-axis">
              {formatNumber(v, locale)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const h = y(0) - y(r.value);
          const lines = [formatNumber(r.value, locale), `${formatNumber(r.surah, locale)}. ${r.name}`, t(r.place), ...(r.extra ? [r.extra] : [])];
          return (
            <g key={r.surah}>
              <rect
                x={x(i) - (step - bw) / 2}
                y={PAD.top}
                width={step}
                height={H - PAD.top - PAD.bottom}
                fill="transparent"
                onPointerMove={(e) => tip.show(e, lines)}
                onPointerLeave={tip.hide}
                onClick={onPick ? () => onPick(r.surah) : undefined}
                className={onPick ? "cursor-pointer" : undefined}
              />
              <path
                d={h > 0 ? `M${x(i)},${y(0)} v${-(h - Math.min(4, h, bw / 2))} q0,${-Math.min(4, h, bw / 2)} ${Math.min(4, bw / 2)},${-Math.min(4, h, bw / 2)} h${bw - 2 * Math.min(4, bw / 2)} q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, h, bw / 2)} v${h - Math.min(4, h, bw / 2)} z` : ""}
                fill={r.place === "meccan" ? "var(--chart-meccan)" : "var(--chart-medinan)"}
                pointerEvents="none"
              />
              {(i % 10 === 0 || i === rows.length - 1) && (
                <text x={x(i) + bw / 2} y={H - 6} textAnchor="middle" className="chart-axis">
                  {formatNumber(by === "mushaf" ? r.surah : r.order, locale)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.side} x2={W - PAD.side} y1={y(0)} y2={y(0)} stroke="var(--line-2)" strokeWidth={1} />
      </svg>
      {tip.layer}
    </div>
  );
}
