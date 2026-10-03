"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { RootGraphPayload } from "@/lib/graph/build";
import { getJSON } from "@/lib/reader/api";

// the canvas and its layout engine load only when the map comes into view: a root page stays light
const RootGraphView = dynamic(() => import("@/components/graph/RootGraphView").then((m) => m.RootGraphView), { ssr: false });

/**
 * The root's map on its own page (QAN-21): the graph generated from the data — the root, its patterns, its words —
 * read-only, explored in place (folding and extracting change only this view), and kept as the reader's own map by
 * "Save a copy". Loaded when it comes into view.
 */
export function RootMap({ rootKey }: { rootKey: string }) {
  const t = useTranslations("graph");
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((xs) => xs.some((x) => x.isIntersecting) && setSeen(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const g = useQuery({ queryKey: ["root-graph", rootKey], queryFn: () => getJSON<RootGraphPayload>(`/roots/${encodeURIComponent(rootKey)}/graph`), enabled: seen, staleTime: 10 * 60_000 });
  return (
    <div ref={box} className="root-map">
      {g.data ? (
        <RootGraphView payload={g.data} embedded />
      ) : g.isError ? (
        <p className="p-4 text-[13px] text-t3" role="status">
          {t("rootMapFailed")} <Link href={`/graph/root/${encodeURIComponent(rootKey)}`} className="underline">{t("rootMapOpen")}</Link>
        </p>
      ) : (
        <span className="block h-full animate-pulse rounded-xl bg-card-2" aria-hidden="true" />
      )}
    </div>
  );
}
