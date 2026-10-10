"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useRef, useState } from "react";

/**
 * A chart's frame (P16, D36): its title, what was counted and how (law L4), the chart, its legend, and its numbers as
 * a table — the chart's twin for screen readers and for anyone who wants the figures.
 */
export function Figure({ title, caption, legend, table, children, id }: { title: string; caption?: ReactNode; legend?: ReactNode; table?: ReactNode; children: ReactNode; id?: string }) {
  const t = useTranslations("charts");
  return (
    <figure className="chart-fig" aria-labelledby={id ? `${id}-t` : undefined}>
      <figcaption className="flex flex-col gap-1">
        <h3 id={id ? `${id}-t` : undefined} className="text-[14.5px] font-semibold text-t1">{title}</h3>
        {caption && <p className="text-[12px] leading-relaxed text-t3">{caption}</p>}
      </figcaption>
      {legend && <div className="chart-legend">{legend}</div>}
      <div className="chart-body">{children}</div>
      {table && (
        <details className="chart-table">
          <summary className="cursor-pointer text-[12px] text-t2">{t("asTable")}</summary>
          <div className="mt-2 max-h-[420px] overflow-auto">{table}</div>
        </details>
      )}
    </figure>
  );
}

/** A swatch and its label, the mark's colour beside text in the text's colour. */
export function Key({ color, label, shape = "rect" }: { color: string; label: string; shape?: "rect" | "line" | "dot" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-t2">
      <span aria-hidden="true" className={`chart-key is-${shape}`} style={{ background: color }} />
      {label}
    </span>
  );
}

/** A sequential scale's key: none to the most, in the chart's one hue. */
export function RampKey({ hue, low, high }: { hue: string; low: string; high: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-t3" aria-hidden="true">
      <span>{low}</span>
      <span className="chart-ramp" style={{ ["--hue" as string]: hue }} />
      <span>{high}</span>
    </span>
  );
}

/** One tooltip per chart, placed at the pointer or at the focused mark, its value first. Content is text only. */
export function useTip() {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const show = useCallback((e: { clientX: number; clientY: number } | DOMRect, lines: string[]) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const x = "clientX" in e ? e.clientX : e.left + e.width / 2;
    const y = "clientY" in e ? e.clientY : e.top;
    setTip({ x: x - r.left, y: y - r.top, lines });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const layer = (
    <div ref={box} className="chart-tip-layer" aria-hidden="true">
      {tip && (
        <div className="chart-tip" style={{ insetInlineStart: undefined, left: tip.x, top: tip.y }}>
          {tip.lines.map((l, i) => (
            <div key={i} className={i === 0 ? "text-[13px] font-semibold text-t1" : "text-[11.5px] text-t2"} dir="auto">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
  return { show, hide, layer };
}

/** A colour on a one-hue scale from the card to the hue, as CSS (sequential: light to dark). */
export const shade = (hue: string, share: number) => `color-mix(in srgb, ${hue} ${Math.round(Math.max(0, Math.min(1, share)) * 100)}%, var(--card))`;
