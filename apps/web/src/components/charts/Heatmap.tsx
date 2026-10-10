"use client";

import { useLocale } from "next-intl";
import { formatNumber } from "@/lib/format";
import { shade, useTip, useWidth } from "./Figure";

export type HeatRow = { key: string; label: string; values: number[]; href?: string };

/**
 * Rows over columns, each cell shaded by its value in one hue (P16): a root over the 114 sūras, or any grid. The
 * darkest cell is the row set's largest value (or, `perRow`, each row's own). Labels stand at the start edge; in
 * Arabic the first column is at the right. Each cell names its row, column and value on hover; the same numbers are
 * the figure's table. Drawn in its own pixels: the cells share the width there is, down to six pixels, and past that
 * the grid scrolls sideways — its labels stay at their size on a phone.
 */
export function Heatmap({ rows, columns, hue = "var(--chart-root)", perRow = false, label, onCell }: { rows: HeatRow[]; columns: string[]; hue?: string; perRow?: boolean; label: string; onCell?: (row: number, col: number) => void }) {
  const locale = useLocale();
  const rtl = locale === "ar";
  const tip = useTip();
  const [box, avail] = useWidth(900);
  const gap = 1;
  const labelW = 64;
  const cell = Math.max(6, Math.floor(((avail - labelW) / columns.length - gap) * 10) / 10);
  // a row is never lower than its label
  const rowH = Math.max(cell + gap, 13);
  const W = labelW + columns.length * (cell + gap);
  const H = rows.length * rowH + 4;
  const all = Math.max(1, ...rows.flatMap((r) => r.values));
  const x = (j: number) => (rtl ? W - labelW - (j + 1) * (cell + gap) : labelW + j * (cell + gap));
  return (
    // scrolls sideways on a phone: a region the keyboard can reach and scroll, named for what it holds
    <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={label} ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block" role="img" aria-label={label} direction="ltr">
        {rows.map((r, i) => {
          const top = perRow ? Math.max(1, ...r.values) : all;
          return (
            <g key={r.key}>
              <text x={rtl ? W - 4 : 4} y={i * rowH + rowH - 3} textAnchor={rtl ? "end" : "start"} className="chart-axis is-ar">
                {r.label}
              </text>
              {r.values.map((v, j) => (
                <rect
                  key={j}
                  x={x(j)}
                  y={i * rowH}
                  width={cell}
                  height={rowH - gap}
                  rx={1.5}
                  fill={v ? shade(hue, 0.12 + 0.88 * (v / top)) : "var(--card-2)"}
                  onPointerMove={(e) => tip.show(e, [formatNumber(v, locale), r.label, columns[j]])}
                  onPointerLeave={tip.hide}
                  onClick={onCell ? () => onCell(i, j) : undefined}
                  className={onCell ? "cursor-pointer" : undefined}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {tip.layer}
    </div>
  );
}

/**
 * The mushaf's 604 pages as a grid of twenty a row, each shaded by the words of a root or a lemma on it (P16): where
 * in the mushaf a word lives, at a glance. Each cell names its page and count on hover; the per-sūra table is the
 * figure's.
 */
export function PageGrid({ pages, hue = "var(--chart-root)", label, onPage }: { pages: number[]; hue?: string; label: string; onPage?: (page: number) => void }) {
  const locale = useLocale();
  const rtl = locale === "ar";
  const tip = useTip();
  const per = 20;
  const cell = 14;
  const gap = 2;
  const labelW = 34;
  const rows = Math.ceil(pages.length / per);
  const W = labelW + per * (cell + gap);
  const H = rows * (cell + gap);
  const top = Math.max(1, ...pages);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[420px]" role="img" aria-label={label} direction="ltr">
        {Array.from({ length: rows }, (_, r) => (
          <text key={r} x={rtl ? W - 2 : 2} y={r * (cell + gap) + cell - 3} textAnchor={rtl ? "end" : "start"} className="chart-axis">
            {formatNumber(r * per + 1, locale)}
          </text>
        ))}
        {pages.map((v, i) => {
          const r = Math.floor(i / per);
          const c = i % per;
          const x = rtl ? W - labelW - (c + 1) * (cell + gap) : labelW + c * (cell + gap);
          return (
            <rect
              key={i}
              x={x}
              y={r * (cell + gap)}
              width={cell}
              height={cell}
              rx={2}
              fill={v ? shade(hue, 0.15 + 0.85 * (v / top)) : "var(--card-2)"}
              onPointerMove={(e) => tip.show(e, [formatNumber(v, locale), `${formatNumber(i + 1, locale)}`])}
              onPointerLeave={tip.hide}
              onClick={onPage ? () => onPage(i + 1) : undefined}
              className={onPage ? "cursor-pointer" : undefined}
            />
          );
        })}
      </svg>
      {tip.layer}
    </div>
  );
}
