"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { usePersonal, useReader } from "@/lib/reader/store";
import { useGoToStep, useStepViews } from "./trailSteps";

const STEP_X = 116;
const STEP_Y = 78;
const NODE_W = 104;
const PAD = 10;

/**
 * The trail as a small canvas (design 03 §3.8, RDR-336…340): the last eight words as cards in reading
 * order, an edge between consecutive steps — in the root colour when both share a root — and a dashed
 * card for where the reader is now. A card truncates the trail there; the trail can be saved for the
 * Notebook, handed to the graph editor, or started over.
 */
export function TrailMap({ chapter }: { chapter: number }) {
  const t = useTranslations("rd");
  const trail = usePersonal((s) => s.trail);
  const saveTrail = usePersonal((s) => s.saveTrail);
  const clearTrail = usePersonal((s) => s.clearTrail);
  const setTrailMap = useReader((s) => s.setTrailMap);
  const setHandoff = useReader((s) => s.setHandoff);
  const showToast = useReader((s) => s.showToast);
  const box = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);

  // As many columns as the panel's width allows (two on the narrowest docked panel).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCols(Math.max(2, Math.min(4, Math.floor((e.contentRect.width - PAD - NODE_W) / STEP_X) + 1))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = useGoToStep(chapter);
  const steps = trail.slice(-8);
  const offset = trail.length - steps.length;
  const views = useStepViews(steps);
  const pos = (i: number) => ({ x: PAD + (i % cols) * STEP_X, y: 12 + Math.floor(i / cols) * STEP_Y });
  const rows = Math.ceil(steps.length / cols);
  const height = Math.max(200, 12 + rows * STEP_Y + 30);

  return (
    <div className="trail-map">
      <div ref={box} className="trail-canvas" style={{ height }}>
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          {steps.slice(1).map((s, k) => {
            const i = k + 1;
            const a = pos(i - 1);
            const b = pos(i);
            const same = !!views[i].root && views[i].root === views[i - 1].root;
            return (
              <line
                key={`${s.id}-${i}`}
                x1={a.x + NODE_W / 2}
                y1={a.y + 30}
                x2={b.x + NODE_W / 2}
                y2={b.y + 30}
                stroke={same ? "var(--c-root)" : "var(--line-2)"}
                strokeWidth={1.3}
                strokeDasharray={i === steps.length - 1 ? "4 3" : undefined}
              />
            );
          })}
        </svg>
        <ol>
          {views.map((v, i) => {
            const s = v.step;
            const p = pos(i);
            const last = i === steps.length - 1;
            return (
              <li key={`${s.id}-${i}`}>
                <button
                  type="button"
                  className="trail-node"
                  style={{ insetInlineStart: p.x, top: p.y, width: NODE_W, ["--node" as string]: v.color }}
                  aria-current={last ? "step" : undefined}
                  title={t("trailBackTo", { w: v.sub || v.label })}
                  onClick={() => go(offset + i, s)}
                >
                  <span className="flex justify-between gap-1.5 text-[10px] text-t3">
                    <span className="font-semibold" style={{ color: v.color }}>{t(s.kind === "word" ? "typeWord" : s.kind === "verse" ? "typeVerse" : "typeRoot")}</span>
                    <span className="mono">{i + 1}</span>
                  </span>
                  <span className={(s.kind === "verse" ? "mono text-[14px]" : "ar-classical text-[17px]") + " truncate leading-[1.5] text-t1"} lang={s.kind === "verse" ? undefined : "ar"} dir={s.kind === "verse" ? "ltr" : "rtl"}>{v.label}</span>
                  <span className="mono truncate text-[10.5px] text-t2" dir="ltr">{v.sub}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="trail-hint">{t("trailMapHint")}</p>
      </div>
      <div className="trail-actions">
        <button
          type="button"
          className="btn text-[12px]"
          onClick={() => {
            saveTrail();
            showToast(t("trailSaved"));
          }}
        >
          {t("saveTrail")}
        </button>
        <button type="button" className="btn text-[12px]" onClick={() => setHandoff({ seed: "trail", steps: trail.map(({ kind, id }) => ({ kind, id })) })}>
          {t("openTrailInEditor")}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          className="btn border-transparent bg-transparent text-[12px] text-t3 hover:text-bad"
          onClick={() => {
            clearTrail();
            setTrailMap(false);
          }}
        >
          {t("newTrail")}
        </button>
      </div>
    </div>
  );
}
