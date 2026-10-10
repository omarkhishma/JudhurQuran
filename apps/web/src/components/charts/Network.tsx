"use client";

import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { scaleLinear, scaleSqrt } from "d3-scale";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { useTip, useWidth } from "./Figure";

export type NetNode = { id: string; label: string; size: number; href?: string; sub?: string };
export type NetEdge = { a: string; b: string; weight: number; note?: string };
type N = NetNode & SimulationNodeDatum;
type E = SimulationLinkDatum<N> & { weight: number; note?: string };

const W = 860;
const H = 620;

/**
 * A network laid out once by a force simulation run to rest before it is drawn (P16; d3-force) — so the picture is
 * the same each time for the same data. Nodes are sized by their count, edges thickened by their weight; hovering or
 * focusing a node lifts it and its neighbours and greys the rest; each node opens where it leads. The edges are the
 * figure's table.
 */
export function Network({ nodes, edges, label, hue = "var(--chart-root)" }: { nodes: NetNode[]; edges: NetEdge[]; label: string; hue?: string }) {
  const locale = useLocale();
  const tip = useTip();
  // shrunk to a phone, the labels keep a readable size (up to twice theirs in the drawing's units)
  const [box, drawn] = useWidth(W);
  const k = Math.min(2, Math.max(1, W / drawn)).toFixed(2);
  const [focus, setFocus] = useState<string | null>(null);
  const laid = useMemo(() => {
    const ns: N[] = nodes.map((n) => ({ ...n }));
    const byId = new Map(ns.map((n) => [n.id, n]));
    const es: E[] = edges.filter((e) => byId.has(e.a) && byId.has(e.b)).map((e) => ({ source: e.a, target: e.b, weight: e.weight, note: e.note }));
    const r = scaleSqrt().domain([0, Math.max(1, ...nodes.map((n) => n.size))]).range([4, 22]);
    const w = scaleLinear().domain([0, Math.max(1, ...edges.map((e) => e.weight))]).range([0.6, 4]);
    // a fixed start: each node on a circle by its place in the list, so the layout does not depend on chance
    ns.forEach((n, i) => {
      const a = (2 * Math.PI * i) / ns.length;
      // rounded: the server's and the browser's sine may differ in the last bit, and the simulation would carry it
      n.x = Math.round(W / 2 + 200 * Math.cos(a));
      n.y = Math.round(H / 2 + 200 * Math.sin(a));
    });
    const sim = forceSimulation(ns)
      .force("link", forceLink<N, E>(es).id((d) => d.id).distance(70).strength(0.4))
      .force("charge", forceManyBody().strength(-160))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<N>().radius((d) => r(d.size) + 14))
      .stop();
    for (let i = 0; i < 320; i++) sim.tick();
    for (const n of ns) {
      n.x = Math.max(28, Math.min(W - 28, n.x ?? 0));
      n.y = Math.max(20, Math.min(H - 20, n.y ?? 0));
    }
    return { ns, es, r, w };
  }, [nodes, edges]);
  // a label below its node, or above it, where it covers no other label and no node as large: the largest nodes first;
  // the others name themselves on a touch or on focus, and in the table
  const labelled = useMemo(() => {
    const s = Number(k);
    type Box = [number, number, number, number, string];
    const hits = (a: Box, b: Box) => a[4] !== b[4] && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const dot = (n: N): Box => {
      const r = laid.r(n.size);
      return [(n.x ?? 0) - r, (n.y ?? 0) - r, (n.x ?? 0) + r, (n.y ?? 0) + r, n.id];
    };
    const dots: Box[] = [];
    const placed: Box[] = [];
    const out = new Map<string, "below" | "above">();
    for (const n of [...laid.ns].sort((a, b) => b.size - a.size)) {
      const w = n.label.length * 6.5 * s;
      const r = laid.r(n.size);
      for (const side of ["below", "above"] as const) {
        const top = side === "below" ? (n.y ?? 0) + r + 2 : (n.y ?? 0) - r - 2 - 13 * s;
        const b: Box = [(n.x ?? 0) - w / 2, top, (n.x ?? 0) + w / 2, top + 13 * s, n.id];
        if (placed.some((p) => hits(b, p)) || dots.some((d) => hits(b, d))) continue;
        placed.push(b);
        out.set(n.id, side);
        break;
      }
      dots.push(dot(n));
    }
    return out;
  }, [laid, k]);
  const near = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    for (const e of laid.es) {
      const a = (e.source as N).id;
      const b = (e.target as N).id;
      if (a === focus) s.add(b);
      if (b === focus) s.add(a);
    }
    return s;
  }, [focus, laid]);
  return (
    <div className="relative" ref={box} style={{ "--k": k } as React.CSSProperties}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={label}>
        {laid.es.map((e, i) => {
          const a = e.source as N;
          const b = e.target as N;
          const on = !near || (near.has(a.id) && near.has(b.id));
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--edge)" strokeWidth={laid.w(e.weight)} strokeOpacity={on ? 0.9 : 0.12} />;
        })}
        {laid.ns.map((n) => {
          const on = !near || near.has(n.id);
          const body = (
            <g
              onPointerEnter={() => setFocus(n.id)}
              onPointerLeave={() => {
                setFocus(null);
                tip.hide();
              }}
              onPointerMove={(e) => tip.show(e, [formatNumber(n.size, locale), n.label, ...(n.sub ? [n.sub] : [])])}
              opacity={on ? 1 : 0.25}
            >
              <circle cx={n.x} cy={n.y} r={laid.r(n.size)} fill={hue} stroke="var(--card)" strokeWidth={2} />
              {(labelled.has(n.id) || n.id === focus) && (
                <text x={n.x} y={labelled.get(n.id) === "above" ? (n.y ?? 0) - laid.r(n.size) - 4 * Number(k) : (n.y ?? 0) + laid.r(n.size) + 12 * Number(k)} textAnchor="middle" className="chart-node-label">
                  {n.label}
                </text>
              )}
            </g>
          );
          return n.href ? (
            <Link key={n.id} href={n.href} prefetch={false} aria-label={n.sub ? `${n.label} — ${n.sub}` : n.label} onFocus={() => setFocus(n.id)} onBlur={() => setFocus(null)}>
              {body}
            </Link>
          ) : (
            <g key={n.id}>{body}</g>
          );
        })}
      </svg>
      {tip.layer}
    </div>
  );
}
