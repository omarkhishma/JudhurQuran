"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cnt, formatNumber } from "@/lib/format";
import { verseId } from "@/lib/graph/build";
import { creditLine, topicCardId, topicOf, type TopicCredit, type TopicPage, type TopicRow, type VerseTopics } from "@/lib/graph/topics";
import type { GraphNode } from "@/lib/graph/types";
import { getJSON } from "@/lib/reader/api";
import type { CanvasTools } from "./GraphCanvas";

/**
 * Topics on the map (P8.3, QAN-09; research 06 Part 3, D29): Quranpedia's Arabic topics — found by name in the
 * library, a topic's chain, sub-topics and verses in its card's Meaning, a verse's topics in the verse's — each put on
 * the map as a heading card the verses and sub-topics are gathered under. Every list says whose topics they are and
 * the version of the data.
 */

function Credit({ sources }: { sources: Record<string, TopicCredit> }) {
  const locale = useLocale();
  const c = Object.values(sources)[0];
  if (!c) return null;
  return (
    <p className="text-[11px] text-t3">
      <a href={c.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{creditLine(c, locale)}</a>
    </p>
  );
}

/** The library's topic search: a topic's name, how many verses it gathers; added at the middle of the view. */
export function TopicSearch({ tools }: { tools: CanvasTools }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const query = q.trim();
  const found = useQuery({
    queryKey: ["topics", query],
    queryFn: () => getJSON<{ total: number; data: TopicRow[]; sources: Record<string, TopicCredit> }>(`/topics?${new URLSearchParams(query ? { q: query, limit: "12" } : { limit: "12" })}`),
    staleTime: 10 * 60_000,
  });
  return (
    <section className="library-section" aria-labelledby="lib-topics-h">
      <p id="lib-topics-h" className="label-caps">{t("topicsTitle")}</p>
      <input className="field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("topicsSearch")} aria-label={t("topicsSearch")} dir="auto" />
      {found.data && (
        <>
          <ul className="flex flex-col gap-1">
            {found.data.data.map((x) => {
              const on = tools.nodes.some((n) => n.id === topicCardId(x.id));
              return (
                <li key={x.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate text-t1" lang="ar" title={x.name}>{x.name}</span>
                  <span className="mono text-[11px] text-t3">{formatNumber(x.verses, locale)}</span>
                  <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={on || !tools.editable} onClick={() => tools.addTopic(x, Object.values(found.data.sources)[0])} aria-label={t("topicAdd", { name: x.name })}>
                    {on ? t("onMap") : "+"}
                  </button>
                </li>
              );
            })}
          </ul>
          {found.data.total === 0 && <p className="text-[12px] text-t3">{t("topicsNone")}</p>}
          <Credit sources={found.data.sources} />
        </>
      )}
    </section>
  );
}

/** A topic card's Meaning: the topics above it, its sub-topics and its verses, each addable under the right card. */
export function TopicMeaning({ tools, card }: { tools: CanvasTools; card: GraphNode }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const tid = topicOf(card.id)!;
  const q = useQuery({ queryKey: ["topic", tid], queryFn: () => getJSON<TopicPage>(`/topics/${encodeURIComponent(tid)}?limit=12`), staleTime: 10 * 60_000 });
  if (q.isPending) return <p className="text-[12.5px] text-t3">…</p>;
  if (!q.data) return <p className="text-[12.5px] text-t3">{t("topicFailed")}</p>;
  const p = q.data;
  const credit = Object.values(p.sources)[0];
  const linked = new Set(tools.edges.filter((e) => e.target === card.id).map((e) => e.source));
  const onMap = (id: string) => tools.nodes.some((n) => n.id === id);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[16px] font-semibold text-t1" lang="ar">{p.name}</p>
        <p className="text-[12px] text-t3">{t("topicCard")}</p>
        <Credit sources={p.sources} />
      </div>
      {p.chain.length > 0 && (
        <section className="flex flex-col gap-1" aria-label={t("topicChain")}>
          <p className="label-caps">{t("topicChain")}</p>
          {p.chain.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 text-[12.5px]" style={{ paddingInlineStart: i * 10 }}>
              <span className="min-w-0 flex-1 truncate" lang="ar">{c.name}</span>
              {/* the topic just above this one gathers it */}
              {i === p.chain.length - 1 && tools.editable && (
                <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={onMap(topicCardId(c.id))} onClick={() => tools.addTopic(c, credit, { from: card.id, to: topicCardId(c.id) })}>
                  {onMap(topicCardId(c.id)) ? t("onMap") : t("topicAddParent")}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      {p.subtopics.length > 0 && (
        <section className="flex flex-col gap-1" aria-label={t("topicSubtopics")}>
          <p className="label-caps">{t("topicSubtopics")}</p>
          {p.subtopics.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate" lang="ar">{s.name}</span>
              <span className="mono text-[11px] text-t3">{formatNumber(s.verses, locale)}</span>
              {tools.editable && (
                <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={onMap(topicCardId(s.id))} onClick={() => tools.addTopic(s, credit, { from: topicCardId(s.id), to: card.id })}>
                  {onMap(topicCardId(s.id)) ? t("onMap") : "+"}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      <section className="flex flex-col gap-1" aria-label={t("topicVerses")}>
        <p className="label-caps">{t("topicVerses")}</p>
        <p className="text-[12.5px] text-t2">{t("topicVersesCount", { ...cnt(p.total, locale), on: formatNumber(p.data.filter((v) => linked.has(verseId(v.verse_key))).length, locale) })}</p>
        {p.total > 0 && tools.editable && (
          <button type="button" className="btn self-start text-[12px]" disabled={!!tools.expanding} onClick={() => tools.addTopicVerses(card.id)}>
            {t("topicAddVerses")}
          </button>
        )}
        {p.total === 0 && <p className="text-[12px] text-t3">{t("topicNoVerses")}</p>}
      </section>
    </div>
  );
}

/** A verse's topics in its Meaning: each with the topic above it, addable as the card the verse is gathered under. */
export function VerseTopicsList({ tools, card, verseKey }: { tools: CanvasTools; card: GraphNode; verseKey: string }) {
  const t = useTranslations("graph");
  const q = useQuery({ queryKey: ["verse-topics", verseKey], queryFn: () => getJSON<VerseTopics>(`/verses/${verseKey}/topics`), staleTime: 10 * 60_000 });
  if (!q.data || !q.data.data.length) return null;
  const credit = Object.values(q.data.sources)[0];
  const linked = (id: string) => tools.edges.some((e) => e.source === card.id && e.target === topicCardId(id));
  return (
    <section className="flex flex-col gap-1" aria-label={t("verseTopics")}>
      <p className="label-caps">{t("verseTopics")}</p>
      {q.data.data.map((x) => (
        <div key={x.id} className="flex items-center gap-2 text-[12.5px]">
          <span className="min-w-0 flex-1" lang="ar">
            {x.name}
            {x.parent_name && <span className="block text-[11px] text-t3">{x.parent_name}</span>}
          </span>
          {tools.editable && tools.topicLinks && (
            <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={linked(x.id)} onClick={() => tools.addTopic(x, credit, { from: card.id, to: topicCardId(x.id) })} aria-label={t("topicAdd", { name: x.name })}>
              {linked(x.id) ? t("onMap") : "+"}
            </button>
          )}
        </div>
      ))}
      <Credit sources={q.data.sources} />
    </section>
  );
}
