"use client";

import { useTranslations } from "next-intl";
import { usePersonal, useReader } from "@/lib/reader/store";
import { useGoToStep, useStepViews } from "./trailSteps";

/** The trail breadcrumb (design 03 §3.8, RDR-333…335): the last six steps — words, verses, roots
 * (RDR-568) — shown once the trail holds two distinct steps; clicking a step truncates the trail there. */
export function Trail({ chapter }: { chapter: number }) {
  const t = useTranslations("rd");
  const trail = usePersonal((s) => s.trail);
  const trailMap = useReader((s) => s.trailMap);
  const setTrailMap = useReader((s) => s.setTrailMap);
  const go = useGoToStep(chapter);
  const last = trail.slice(-6);
  const offset = trail.length - last.length;
  const views = useStepViews(last);
  const distinct = new Set(trail.map((s) => `${s.kind}:${s.id}`));
  if (distinct.size < 2) return null;
  return (
    <nav className="trail" aria-label={t("trail")}>
      <span className="text-[11px] text-t3">{t("trail")}</span>
      <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {views.map((v, i) => {
          const current = i === views.length - 1;
          return (
            <li key={`${v.step.kind}-${v.step.id}-${i}`} className="flex items-center gap-1">
              {i > 0 && <span className="text-line-2" aria-hidden="true">›</span>}
              <button
                type="button"
                className={"trail-step text-[12px] " + (current ? "font-medium text-t1" : "text-t3 hover:text-t1")}
                data-kind={v.step.kind}
                aria-current={current || undefined}
                onClick={() => go(offset + i, v.step)}
                dir={v.step.kind === "verse" ? "ltr" : "auto"}
              >
                {v.label}
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" className="chip text-[11.5px]" aria-expanded={trailMap} onClick={() => setTrailMap(!trailMap)}>
        {trailMap ? t("hideMap") : t("mapN", { n: trail.length })}
      </button>
    </nav>
  );
}
