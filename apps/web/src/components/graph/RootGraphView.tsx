"use client";

import { useLocale, useTranslations } from "next-intl";
import { translitOn, useGraphUi } from "@/lib/graph/uiPrefs";
import { useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { buildRootGraph, type RootGraphPayload } from "@/lib/graph/build";
import { createGraph } from "@/lib/graph/persist";
import type { GraphEdge, GraphNode } from "@/lib/graph/types";
import { GraphCanvas } from "./GraphCanvas";

/**
 * A root's graph generated from the data, read-only (QAN-21): explored in place — folding and extracting change only
 * this view — and kept as the reader's own map by "Save a copy". Its own page, or embedded on the root's page.
 */
export function RootGraphView({ payload, focus, embedded }: { payload: RootGraphPayload; focus?: string; embedded?: boolean }) {
  const t = useTranslations("graph");
  const translit = translitOn(useGraphUi((u) => u.translit), useLocale());
  const router = useRouter();
  const initial = useMemo(() => buildRootGraph(payload, { focusLocation: focus }), [payload, focus]);
  const current = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }>(initial);
  const [saving, setSaving] = useState(false);
  const title = t("rootTitle", { root: payload.root.spaced });

  async function saveCopy() {
    setSaving(true);
    const id = await createGraph({ title, kind: "root", nodes: current.current.nodes, edges: current.current.edges });
    router.push(`/graph/edit/${id}`);
  }

  return (
    <GraphCanvas
      initialNodes={initial.nodes}
      initialEdges={initial.edges}
      autoLayout
      title={title}
      fileName={`root-${payload.root.translit}`}
      kind="root"
      translit={translit}
      onChange={(nodes, edges) => (current.current = { nodes, edges })}
      embedded={embedded}
      toolbarExtra={
        <>
          {embedded ? (
            <Link href={`/graph/root/${encodeURIComponent(payload.root.key)}`} className="btn">{t("rootMapOpen")}</Link>
          ) : (
            <Link href={`/roots/${encodeURIComponent(payload.root.key)}`} className="btn">{t("openRoot")}</Link>
          )}
          <button type="button" className="btn btn-primary" onClick={() => void saveCopy()} disabled={saving}>
            {t("saveCopy")}
          </button>
        </>
      }
    />
  );
}
