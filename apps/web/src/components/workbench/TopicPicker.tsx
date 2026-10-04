"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { getTargets } from "@/lib/editorial";

/**
 * A topic the board works on, found by name (P8.3b): one of Quranpedia's, one of La Beaume's chapters, or one of the
 * board's own — where a verse QSAC suggested, or a heading, is put. The server refuses a topic it does not know and a
 * place that would put a topic under itself.
 */
export function TopicPicker({ value, label, onPick, exclude }: { value: string; label?: string; onPick: (id: string, label: string) => void; exclude?: string }) {
  const t = useTranslations("workbench");
  const [q, setQ] = useState("");
  const query = q.trim();
  const found = useQuery({
    queryKey: ["editorial-targets", "topic", "pick", query],
    queryFn: () => getTargets("topic", { state: "all", q: query, offset: 0, limit: 8 }),
    enabled: query.length > 0,
    staleTime: 60_000,
  });
  return (
    <div className="flex flex-col gap-1.5">
      {value && (
        <p className="text-[12.5px] text-t1">
          {t("placedUnder")} <span lang="ar" dir="auto" className="font-medium">{label || value}</span> <span className="mono text-[11px] text-t3" dir="ltr">{value}</span>
        </p>
      )}
      <input className="field-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("topicPickSearch")} aria-label={t("topicPickSearch")} dir="auto" />
      {found.data && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("topicPickResults")}>
          {found.data.data
            .filter((x) => x.key !== exclude)
            .map((x) => (
              <button key={x.key} type="button" className={"chip" + (value === x.key ? " is-on" : "")} aria-pressed={value === x.key} onClick={() => onPick(x.key, x.label)} dir="auto">
                <span lang="ar">{x.label || x.key}</span>
                {x.sub && <span className="ms-1 text-[11px] text-t3">{x.sub}</span>}
              </button>
            ))}
          {found.data.total === 0 && <p className="text-[12px] text-t3">{t("topicPickNone")}</p>}
        </div>
      )}
    </div>
  );
}
