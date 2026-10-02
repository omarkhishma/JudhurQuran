"use client";

import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getJSON } from "@/lib/reader/api";
import { usePersonal, useReader } from "@/lib/reader/store";
import type { WordPayload } from "@/lib/reader/types";

/** The trail breadcrumb (design 03 §3.8, RDR-333…335): the last six steps, shown once the trail holds
 * two distinct words; clicking a step truncates the trail there. */
export function Trail() {
  const t = useTranslations("rd");
  const trail = usePersonal((s) => s.trail);
  const truncate = usePersonal((s) => s.truncateTrail);
  const openWord = useReader((s) => s.openWord);
  const trailMap = useReader((s) => s.trailMap);
  const setTrailMap = useReader((s) => s.setTrailMap);
  const distinct = new Set(trail.map((s) => s.id));
  const last = trail.slice(-6);
  const offset = trail.length - last.length;
  const words = useQueries({
    queries: last.map((s) => ({ queryKey: ["word", s.id, null], queryFn: () => getJSON<WordPayload>(`/words/${encodeURIComponent(s.id)}?limit=12`), staleTime: Infinity })),
  });
  if (distinct.size < 2) return null;
  return (
    <nav className="trail" aria-label={t("trail")}>
      <span className="text-[11px] text-t3">{t("trail")}</span>
      <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {last.map((s, i) => {
          const w = words[i]?.data;
          const current = i === last.length - 1;
          return (
            <li key={`${s.id}-${i}`} className="flex items-center gap-1">
              {i > 0 && <span className="text-line-2" aria-hidden="true">›</span>}
              <button
                type="button"
                className={"text-[12px] " + (current ? "font-medium text-t1" : "text-t3 hover:text-t1")}
                aria-current={current || undefined}
                onClick={() => {
                  truncate(offset + i);
                  openWord({ slug: s.id, at: null });
                }}
                dir="auto"
              >
                {w ? w.ar.full : s.id}
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
