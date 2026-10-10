"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { useTip } from "./Figure";

function rgb(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The theme's colours as the canvas needs them, read again when the theme changes. */
function useThemeColours(names: string[]) {
  const [c, setC] = useState<Record<string, [number, number, number]> | null>(null);
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      setC(Object.fromEntries(names.map((n) => [n, rgb(s.getPropertyValue(n) || "#888888")])));
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, [names.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  return c;
}

/**
 * A square matrix drawn on a canvas (P16): the sūras against the sūras, each cell shaded in one hue from the card to
 * the hue by its value; the order is the caller's (clustered, so alike sūras stand together). Each cell names its pair
 * and value on hover. 12,996 cells are too many for a table: the figure lists the closest pairs instead.
 */
export function Matrix({ labels, values, hue = "--chart-medinan", label, onPick }: { labels: string[]; values: number[][]; hue?: string; label: string; onPick?: (i: number, j: number) => void }) {
  const locale = useLocale();
  const rtl = locale === "ar";
  const canvas = useRef<HTMLCanvasElement>(null);
  const tip = useTip();
  const colours = useThemeColours([hue, "--card"]);
  const n = labels.length;
  const size = 456;
  const cell = size / n;
  // the diagonal is every sūra with itself: the scale runs to the largest value off it
  let top = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && values[i][j] > top) top = values[i][j];
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !colours) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr;
    cv.height = size * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const [hr, hg, hb] = colours[hue];
    const [cr, cg, cb] = colours["--card"];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const s = i === j ? 1 : Math.min(1, values[i][j] / (top || 1));
        ctx.fillStyle = `rgb(${Math.round(cr + (hr - cr) * s)},${Math.round(cg + (hg - cg) * s)},${Math.round(cb + (hb - cb) * s)})`;
        const x = rtl ? size - (j + 1) * cell : j * cell;
        ctx.fillRect(x, i * cell, Math.ceil(cell), Math.ceil(cell));
      }
  }, [colours, values, n, cell, rtl, hue, top]);
  const at = (e: React.PointerEvent | React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const j = Math.min(n - 1, Math.max(0, Math.floor((rtl ? 1 - fx : fx) * n)));
    const i = Math.min(n - 1, Math.max(0, Math.floor(fy * n)));
    return [i, j] as const;
  };
  return (
    <div className="relative w-full max-w-[456px]">
      <canvas
        ref={canvas}
        className="aspect-square w-full rounded-md"
        role="img"
        aria-label={label}
        onPointerMove={(e) => {
          const [i, j] = at(e);
          tip.show(e, [formatNumber(values[i][j], locale), `${labels[i]} • ${labels[j]}`]);
        }}
        onPointerLeave={tip.hide}
        onClick={onPick ? (e) => onPick(...at(e)) : undefined}
      />
      {tip.layer}
    </div>
  );
}
