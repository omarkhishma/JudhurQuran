"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cnt, formatNumber } from "@/lib/format";
import { META } from "@/lib/graph/relations";
import { KIND_COLOR, type GraphNode, type NodeKind } from "@/lib/graph/types";
import { useCanvasTools, type CanvasTools } from "./GraphCanvas";

/**
 * The details beside the canvas (EDT-022; its Meaning and Settings tabs are P8.1-D): the selected card — its kind,
 * headline, count and every link with what it says, each one a way to the card at its other end — or, with
 * nothing selected, what the map holds.
 */
export function Details({ title }: { title: string }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const tools = useCanvasTools();
  const one = tools.selected.length === 1 ? tools.selected[0] : null;
  return (
    <aside className="graph-details" aria-label={t("details")}>
      {one ? (
        <CardDetails tools={tools} card={one} />
      ) : tools.selected.length > 1 ? (
        <p className="text-[13px] text-t2">{t("selectedCount", cnt(tools.selected.length, locale))}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="label-caps">{t("thisMap")}</p>
          <p className="text-[15px] font-semibold text-t1">{title}</p>
          <p className="text-[12.5px] text-t2">
            {t(`mapType_${tools.kind}`)} · {t("cards", cnt(tools.nodes.length, locale))} · {t("links", cnt(tools.edges.length, locale))}
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {(["root", "pattern", "lemma", "verse", "note", "frame"] as NodeKind[])
              .map((k) => [k, tools.nodes.filter((n) => n.data.kind === k).length] as const)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => (
                <li key={k} className="flex items-center gap-2 text-[12.5px] text-t2">
                  <span className="dot" style={{ background: KIND_COLOR[k] }} />
                  {t(META[k].label)}
                  <span className="mono ms-auto text-[11.5px] text-t3">{formatNumber(n, locale)}</span>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-[12px] leading-relaxed text-t3">{t("detailsHint")}</p>
        </div>
      )}
    </aside>
  );
}

function CardDetails({ tools, card }: { tools: CanvasTools; card: GraphNode }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const d = card.data;
  const links = tools.edges.filter((e) => e.source === card.id || e.target === card.id);
  const reader = d.kind === "lemma" && d.first ? `/word/${d.first}` : d.kind === "verse" && d.verse ? (d.places?.length === 1 ? `/word/${d.places[0]}` : `/quran/${d.verse.key.replace(":", "/")}`) : d.kind === "root" && d.rootKey ? `/roots/${encodeURIComponent(d.rootKey)}` : null;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: KIND_COLOR[d.kind] }}>
        <span className="dot" style={{ background: KIND_COLOR[d.kind] }} />
        {t(d.phrase ? "kindPhrase" : META[d.kind].label)}
      </p>
      {d.kind === "note" ? (
        <p className={"whitespace-pre-wrap text-t1 " + (d.phrase ? "ar-classical text-[19px] leading-[1.6]" : "text-[14px]")} dir="auto">{d.text || t("noteEmpty")}</p>
      ) : (
        <p className="ar-classical text-[24px] leading-[1.5] text-t1" lang="ar">{tools.cardName(card.id) || "—"}</p>
      )}
      {d.count != null && <p className="text-[12.5px] text-t2">{t("inQuranCount", cnt(d.count, locale))}</p>}
      {reader && (
        <Link href={reader} className="btn self-start text-[12.5px]">
          {d.kind === "root" ? t("openRoot") : t("openReader")}
        </Link>
      )}
      <p className="label-caps mt-2">{t("linksOf", cnt(links.length, locale))}</p>
      {links.length === 0 ? (
        <p className="text-[12.5px] text-t3">{t("noLinks")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {links.map((e) => {
            const other = e.source === card.id ? e.target : e.source;
            const out = e.source === card.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-start text-[12.5px] hover:bg-card-2"
                  onClick={() => {
                    tools.select(other);
                    tools.center(other);
                  }}
                >
                  <span className="text-t3">{out ? "←" : "→"}</span>
                  <span className="text-t2">{t(`rel_${e.data?.rel ?? "next"}`)}</span>
                  <span className="min-w-0 truncate text-t1" lang="ar">{tools.cardName(other)}</span>
                  {e.data?.label && <span className="min-w-0 truncate text-t3">· {e.data.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
