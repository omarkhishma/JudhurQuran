"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cnt, formatNumber } from "@/lib/format";
import { rootId } from "@/lib/graph/build";
import { bookOf, endsOf, fieldCardId, type RelationEdge, type RootRelations } from "@/lib/graph/meaning";
import type { GraphEdge, GraphNode } from "@/lib/graph/types";
import { getJSON } from "@/lib/reader/api";
import type { CanvasTools } from "./GraphCanvas";

/**
 * A root's relations in the classical books (P8.4, research 15), in its Meaning: those the editorial board has
 * reviewed, each addable to the map as the map's own link; then those only extracted, said to be, each addable as the
 * reader's own link, marked as not reviewed. The book's words are quoted as they are, with the book and its place.
 */
export function RootRelationsList({ tools, card, rootKey }: { tools: CanvasTools; card: GraphNode; rootKey: string }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["root-relations", rootKey], queryFn: () => getJSON<RootRelations>(`/roots/${encodeURIComponent(rootKey)}/relations`), staleTime: 5 * 60_000 });
  const [more, setMore] = useState(false);
  if (q.isPending) return null;
  if (!q.data) return <p className="text-[12px] text-t3">{t("relateFailed")}</p>;
  const pairs = q.data.data.filter((e) => endsOf(e));
  const extracted = q.data.extracted;
  return (
    <>
    <section className="flex flex-col gap-2" aria-label={t("relationsTitle")}>
      <p className="label-caps">{t("relationsTitle")}</p>
      {!tools.meaningLinks && <p className="text-[11.5px] text-t3">{t("relationsMapType")}</p>}
      {pairs.length === 0 ? (
        <p className="text-[12.5px] leading-relaxed text-t3">
          {t("relationsNone")} {q.data.waiting > 0 && t("relationsWaiting", cnt(q.data.waiting, locale))}
        </p>
      ) : (
        pairs.map((e) => <RelationItem key={e.id} e={e} tools={tools} card={card} rootKey={rootKey} reviewed />)
      )}
      {extracted.length > 0 && (
        <>
          <button type="button" className="self-start text-[12px] text-t2 underline-offset-2 hover:underline" aria-expanded={more} onClick={() => setMore(!more)}>
            {t("relationsExtracted", cnt(q.data.extracted_total, locale))}
          </button>
          {more && (
            <>
              <p className="text-[11.5px] leading-relaxed text-amber">{t("relationsExtractedNote")}</p>
              {q.data.extracted_total > extracted.length && <p className="text-[11.5px] text-t3">{t("relationsFirstN", { n: formatNumber(extracted.length, locale) })}</p>}
              {extracted.map((e) => (
                <RelationItem key={e.id} e={e} tools={tools} card={card} rootKey={rootKey} reviewed={false} />
              ))}
            </>
          )}
        </>
      )}
    </section>
    <FieldsList tools={tools} card={card} rel={q.data} />
    </>
  );
}

/** The fields whose chapters name a word of this root (P8.4c): reviewed ones the map's own, the extracted ones said to
 * be; put on the map, a field is one card its members link to. */
function FieldsList({ tools, card, rel }: { tools: CanvasTools; card: GraphNode; rel: RootRelations }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const [more, setMore] = useState(false);
  const reviewed = rel.data.filter((e) => e.rel === "field-member");
  const extracted = rel.fields_extracted ?? [];
  if (!reviewed.length && !extracted.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={t("relFieldsTitle")}>
      <p className="label-caps">{t("relFieldsTitle")}</p>
      {reviewed.length === 0 ? <p className="text-[12.5px] text-t3">{t("relFieldsNone")}</p> : reviewed.map((e) => <FieldItem key={e.id} e={e} tools={tools} card={card} reviewed />)}
      {extracted.length > 0 && (
        <>
          <button type="button" className="self-start text-[12px] text-t2 underline-offset-2 hover:underline" aria-expanded={more} onClick={() => setMore(!more)}>
            {t("relFieldsExtracted", cnt(rel.fields_extracted_total, locale))}
          </button>
          {more && (
            <>
              {rel.fields_extracted_total > extracted.length && <p className="text-[11.5px] text-t3">{t("relationsFirstN", { n: formatNumber(extracted.length, locale) })}</p>}
              {extracted.map((e) => <FieldItem key={e.id} e={e} tools={tools} card={card} reviewed={false} />)}
            </>
          )}
        </>
      )}
    </section>
  );
}

function FieldItem({ e, tools, card, reviewed }: { e: RelationEdge; tools: CanvasTools; card: GraphNode; reviewed: boolean }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const id = fieldCardId(e);
  const on = !!id && tools.edges.some((x) => x.source === card.id && x.target === id);
  return (
    <figure className={"meaning-quote" + (reviewed ? "" : " is-extracted")}>
      <figcaption className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
        <span className="ar-classical text-[16px] font-bold text-t1" lang="ar">{e.sense ?? e.field?.title}</span>
        <span className="text-t2" lang="ar">«{e.a.word}»</span>
      </figcaption>
      {e.field?.section && <p className="text-[11px] text-t3" lang="ar">{e.field.section}</p>}
      <blockquote className={"ar-classical text-[14.5px] leading-[1.9] text-t1" + (open ? "" : " line-clamp-3")} lang="ar" dir="rtl">{e.quote}</blockquote>
      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-t3">
        <button type="button" className="hover:text-t1" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? t("showLess") : t("showMore")}</button>
        <span className="flex-1" />
        <span>{bookOf(e, locale)}</span>
      </div>
      {tools.meaningLinks && tools.editable && (
        on ? (
          <span className="text-[11.5px] text-t3">{t("fieldMemberOnMap")}</span>
        ) : (
          <button type="button" className="btn self-start text-[12px]" onClick={() => tools.addFieldMember(e, card.id, reviewed)}>
            {t(reviewed ? "addFieldMember" : "addOwnFieldMember")}
          </button>
        )
      )}
    </figure>
  );
}

function RelationItem({ e, tools, card, rootKey, reviewed }: { e: RelationEdge; tools: CanvasTools; card: GraphNode; rootKey: string; reviewed: boolean }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ends = endsOf(e)!;
  const other = ends[0] === rootKey ? ends[1] : ends[0];
  const on = tools.edges.some((x) => (x.source === rootId(rootKey) && x.target === rootId(other)) || (x.source === rootId(other) && x.target === rootId(rootKey)));
  return (
    <figure className={"meaning-quote" + (reviewed ? "" : " is-extracted")}>
      <figcaption className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
        <span className="ar-classical text-[17px] text-root" lang="ar">{[...other].join(" ")}</span>
        <span className="text-t2" lang="ar">{t("relationWords", { a: e.a.word, b: e.b?.word ?? "" })}</span>
        {e.sense && <span className="text-t3" lang="ar">— {e.sense}</span>}
      </figcaption>
      <blockquote className={"ar-classical text-[14.5px] leading-[1.9] text-t1" + (open ? "" : " line-clamp-3")} lang="ar" dir="rtl">{e.quote}</blockquote>
      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-t3">
        <button type="button" className="hover:text-t1" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? t("showLess") : t("showMore")}</button>
        <span className="flex-1" />
        <span>{bookOf(e, locale)}</span>
      </div>
      {e.review?.note && <p className="text-[11.5px] text-t2">{t("relationBoardNote", { note: e.review.note })}</p>}
      {tools.meaningLinks && tools.editable && (
        on ? (
          <span className="text-[11.5px] text-t3">{t("relationOnMap")}</span>
        ) : (
          <button type="button" className="btn self-start text-[12px]" onClick={() => tools.addRelation(e, card.id, reviewed)}>
            {t(reviewed ? "addRelation" : "addOwnRelation")}
          </button>
        )
      )}
    </figure>
  );
}

/**
 * A picked link between two roots (P8.4): the book's words for the relation it draws, whether the board reviewed it
 * — or that it is only extracted — and the verses the two roots share, ten at a time onto the map.
 */
export function RelationInfo({ edge, tools }: { edge: GraphEdge; tools: CanvasTools }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const a = tools.nodes.find((n) => n.id === edge.source)?.data.rootKey;
  const b = tools.nodes.find((n) => n.id === edge.target)?.data.rootKey;
  const rid = edge.data?.relation;
  const q = useQuery({ queryKey: ["relation", rid], queryFn: () => getJSON<RelationEdge>(`/relations/${encodeURIComponent(rid!)}`), enabled: !!rid, staleTime: 10 * 60_000, retry: false });
  const shared = useQuery({
    queryKey: ["roots-shared", a, b],
    queryFn: () => getJSON<{ count: number }>(`/roots/${encodeURIComponent(a!)}/shared?with=${encodeURIComponent(b!)}&limit=1`),
    enabled: !!a && !!b && a !== b,
    staleTime: 10 * 60_000,
  });
  if (!rid && !(a && b)) return null;
  return (
    <div className="relation-info flex basis-full flex-col gap-1.5">
      {rid && q.data && (
        <>
          <p className={"text-[12px] " + (q.data.status === "in_force" ? "text-t2" : "text-amber")}>
            {t(q.data.status === "in_force" ? "relFromReviewed" : "relFromExtracted", { book: bookOf(q.data, locale) })}
          </p>
          <blockquote className="ar-classical line-clamp-3 text-[14px] leading-[1.9] text-t1" lang="ar" dir="rtl">{q.data.quote}</blockquote>
        </>
      )}
      {rid && q.isError && <p className="text-[12px] text-amber">{t("relGone")}</p>}
      {a && b && shared.data && (
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-t2">
          {shared.data.count ? t("sharedCount", cnt(shared.data.count, locale)) : t("sharedNone")}
          {shared.data.count > 0 && tools.editable && (
            <button type="button" className="btn text-[12px]" disabled={!!tools.expanding} onClick={() => tools.addShared(edge.id)}>
              {t("addShared", { k: formatNumber(Math.min(10, shared.data.count), locale) })}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
