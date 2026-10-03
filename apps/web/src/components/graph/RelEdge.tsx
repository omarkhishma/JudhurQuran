"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, useStore, type EdgeProps } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { createContext, memo, useContext } from "react";
import { NAMED_ON_CANVAS } from "@/lib/graph/relations";
import { KIND_COLOR, type GraphEdge, type NodeKind } from "@/lib/graph/types";

/** What a wire needs to know of the canvas: the selected cards (a wire touching one is "hot"), each card's kind (a
 * hot wire takes its source's colour), whether links can be cut, and how to cut one. */
export type WireContext = { selected: Set<string>; kindOf: (id: string) => NodeKind | undefined; editable: boolean; unlink: (id: string) => void };
export const WireContextValue = createContext<WireContext>({ selected: new Set(), kindOf: () => undefined, editable: false, unlink: () => {} });

/**
 * A link (EDT-131, EDT-132, EDT-134, HWF-04): idle in the wire colour, hot in its source's colour when it touches a
 * selected card, picked dashed in the ring colour; its width kept on screen when zoomed out; its relation named on
 * it when the kinds do not say it; and, when picked, a pill with its relation and Unlink.
 */
function RelEdgeImpl({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd }: EdgeProps<GraphEdge>) {
  const t = useTranslations("graph");
  const wire = useContext(WireContextValue);
  const k = useStore((s) => s.transform[2]);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const hot = !selected && (wire.selected.has(source) || wire.selected.has(target));
  const scale = 1 / Math.min(1, Math.max(0.4, k));
  const sourceKind = wire.kindOf(source);
  const style: React.CSSProperties = selected
    ? { stroke: "var(--ring)", strokeWidth: 2.4 * scale, strokeDasharray: "7 5", opacity: 1 }
    : hot
      ? { stroke: sourceKind ? KIND_COLOR[sourceKind] : "var(--edge)", strokeWidth: 1.9 * scale, opacity: 0.95 }
      : data?.reading || (data?.relation && !data.reviewed)
        ? // an uncertain reading (F4), or a relation the board has not reviewed (P8.4): dashed amber
          { stroke: "var(--amber)", strokeWidth: 1.5 * scale, strokeDasharray: "5 4", opacity: 0.9 }
        : { stroke: "var(--edge)", strokeWidth: 1.25 * scale };
  const rel = data?.rel;
  const name = data?.label || (rel && NAMED_ON_CANVAS.includes(rel) ? t(`rel_${rel}`) : "");
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={20} />
      {(name || (selected && wire.editable)) && (
        <EdgeLabelRenderer>
          <div className={"wire-label nodrag nopan" + (selected ? " is-picked" : "")} style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }} dir="auto">
            {selected && rel ? <span className="text-t2">{name || t(`rel_${rel}`)}</span> : <span>{name}</span>}
            {selected && wire.editable && (
              <button type="button" className="wire-unlink" onClick={() => wire.unlink(id)} title={t("unlinkTitle")}>
                ✕ {t("unlink")}
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const RelEdge = memo(RelEdgeImpl);
