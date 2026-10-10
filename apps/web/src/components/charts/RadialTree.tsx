"use client";

import { cluster, hierarchy, type HierarchyPointNode } from "d3-hierarchy";
import { linkRadial } from "d3-shape";
import { useMemo } from "react";
import { Link } from "@/i18n/navigation";

export type MindNode = { id: string; label: string; kind: "center" | "branch" | "leaf"; color?: string; href?: string; sub?: string; children?: MindNode[] };

/**
 * A long label cut on a word with an ellipsis; the whole of it is the node's accessible name. An Arabic label's
 * ellipsis is held to its end by a right-to-left mark — the drawing runs left to right, where it would jump to the start.
 */
const short = (s: string, max = 26) => {
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(" ", max);
  return `${s.slice(0, cut > 10 ? cut : max)}…${/[\u0600-\u06ff]/.test(s) ? "\u200f" : ""}`;
};

/**
 * A mind map (P16.4, PV-17): a word or a root at the centre, its branches around it and their leaves on the rim, laid
 * out radially by d3-hierarchy's cluster so that leaves share the circle evenly. Every node that leads somewhere is a
 * link; branch colours are the design's type colours (root, pattern, word, verse, description), named in the legend.
 */
export function RadialTree({ root, label, size = 760 }: { root: MindNode; label: string; size?: number }) {
  const laid = useMemo(() => {
    const h = hierarchy<MindNode>(root);
    const leaves = Math.max(1, h.leaves().length);
    const radius = Math.max(220, Math.min(size / 2 - 110, 40 + leaves * 9));
    const tree = cluster<MindNode>().size([2 * Math.PI, radius]).separation((a, b) => (a.parent === b.parent ? 1 : 1.6));
    return { nodes: tree(h).descendants(), radius };
  }, [root, size]);
  // positions to two decimals: the server's and the browser's sine differ in the last bit, and the page must hydrate as drawn
  const link = linkRadial<unknown, HierarchyPointNode<MindNode>>().angle((d) => d.x).radius((d) => d.y);
  const round = (path: string | null) => (path ?? "").replace(/-?\d+\.\d+/g, (v) => (+v).toFixed(2));
  const S = 2 * (laid.radius + 120);
  const pos = (d: HierarchyPointNode<MindNode>) => [(d.y * Math.cos(d.x - Math.PI / 2)).toFixed(2), (d.y * Math.sin(d.x - Math.PI / 2)).toFixed(2)] as const;
  return (
    <svg viewBox={`${-S / 2} ${-S / 2} ${S} ${S}`} className="mx-auto w-full max-w-[880px]" role="group" aria-label={label} direction="ltr">
      {laid.nodes.slice(1).map((d) => (
        <path key={`l-${d.data.id}`} d={round(link({ source: d.parent!, target: d } as never))} fill="none" stroke="var(--edge)" strokeWidth={d.depth === 1 ? 1.6 : 1} />
      ))}
      {laid.nodes.map((d) => {
        const [x, y] = pos(d);
        const right = d.x < Math.PI;
        const leaf = d.depth > 0 && !d.children;
        const r = d.depth === 0 ? 10 : d.depth === 1 ? 6 : 4;
        const text = (
          <g transform={`translate(${x},${y})`}>
            <circle r={r} fill={d.data.color ?? "var(--c-desc)"} stroke="var(--card)" strokeWidth={2} />
            {d.depth === 0 ? (
              <text y={-18} textAnchor="middle" className="mind-center">{d.data.label}</text>
            ) : (
              <text
                transform={leaf ? `rotate(${((d.x * 180) / Math.PI - 90 + (right ? 0 : 180)).toFixed(2)})` : undefined}
                x={leaf ? (right ? 8 : -8) : 0}
                y={leaf ? 4 : -10}
                textAnchor={leaf ? (right ? "start" : "end") : "middle"}
                className={d.depth === 1 ? "mind-branch" : "mind-leaf"}
              >
                {short(d.data.label)}
              </text>
            )}
          </g>
        );
        return d.data.href ? (
          <Link key={d.data.id} href={d.data.href} prefetch={false} aria-label={d.data.sub ? `${d.data.label} — ${d.data.sub}` : d.data.label}>
            <title>{d.data.label}</title>
            {text}
          </Link>
        ) : (
          <g key={d.data.id}>{text}</g>
        );
      })}
    </svg>
  );
}
