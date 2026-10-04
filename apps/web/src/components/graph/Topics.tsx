"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cnt, formatNumber } from "@/lib/format";
import { verseId } from "@/lib/graph/build";
import { entityCardId, entityCredit, entityOf, type EntityList, type EntityPage, type KnowledgeCredit } from "@/lib/graph/entities";
import { creditLine, QURANPEDIA, topicCardId, topicOf, type TopicCredit, type TopicPage, type TopicRow, type VerseTopics } from "@/lib/graph/topics";
import type { GraphNode } from "@/lib/graph/types";
import { getJSON } from "@/lib/reader/api";
import { usePersonal } from "@/lib/reader/store";
import type { CanvasTools } from "./GraphCanvas";

/**
 * Topics on the map (P8.3, QAN-09; research 06 Part 3, D29; P8.3b): the taxonomy in force — Quranpedia's Arabic
 * topics, with the editorial board's names, places and own topics over them — found by name in the library, a topic's
 * chain, sub-topics and verses in its card's Meaning, a verse's topics in the verse's, each put on the map as a
 * heading card the verses and sub-topics are gathered under. Every list says whose topics they are: the source with
 * the version of its data, the board where it named or placed, QSAC where the board placed a verse after its
 * suggestion. The proper names of the Quran (P3.9's registry) are headings too; the reader's own topics stay their
 * own notes, in a section of their own.
 */

/** Each source in a list with its credit: Quranpedia's with its version, QSAC's and La Beaume's as their terms ask. */
function Credits({ sources }: { sources: Record<string, TopicCredit> }) {
  const locale = useLocale();
  const ids = Object.keys(sources).sort((a, b) => (a === QURANPEDIA ? -1 : b === QURANPEDIA ? 1 : a.localeCompare(b)));
  if (!ids.length) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {ids.map((id) => {
        const c = sources[id];
        return (
          <p key={id} className="text-[11px] leading-relaxed text-t3">
            <a href={c.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {id === QURANPEDIA ? creditLine(c, locale) : locale === "ar" ? c.attribution_ar : c.attribution_en}
            </a>
          </p>
        );
      })}
    </div>
  );
}

/** What the editorial board did to a topic, said beside it: a name of its own (the source's kept), a place in the
 * tree, a La Beaume chapter adopted. */
function BoardNotes({ t: row }: { t: TopicRow }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const ch = row.after?.ref.match(/chapitre (\d+), p\. (\d+)/);
  return (
    <>
      {row.source_id !== QURANPEDIA && <p className="text-[12px] text-t3">{t("topicCardBoardDesc")}</p>}
      {row.after && ch && <p className="text-[12px] text-t2">{t("topicAfter", { n: formatNumber(Number(ch[1]), locale), page: formatNumber(Number(ch[2]), locale), title: row.after.title_fr })}</p>}
      {row.source_name && <p className="text-[12px] text-t2">{t("topicRenamed", { name: row.source_name })}</p>}
      {row.board?.placed && <p className="text-[12px] text-t2">{t("topicPlacedHere")}</p>}
      {row.name_en && locale !== "ar" && <p className="text-[12px] text-t2" lang="en">{row.name_en}</p>}
    </>
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
                  {(x.source_id !== QURANPEDIA || x.board?.named) && <span className="state-chip">{t("byBoard")}</span>}
                  <span className="mono text-[11px] text-t3">{formatNumber(x.verses, locale)}</span>
                  <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={on || !tools.editable} onClick={() => tools.addTopic(x, found.data.sources)} aria-label={t("topicAdd", { name: x.name })}>
                    {on ? t("onMap") : "+"}
                  </button>
                </li>
              );
            })}
          </ul>
          {found.data.total === 0 && <p className="text-[12px] text-t3">{t("topicsNone")}</p>}
          <Credits sources={found.data.sources} />
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
  const q = useQuery({ queryKey: ["topic", tid], queryFn: () => getJSON<TopicPage & { placed: number }>(`/topics/${encodeURIComponent(tid)}?limit=12`), staleTime: 10 * 60_000 });
  if (q.isPending) return <p className="text-[12.5px] text-t3">…</p>;
  if (!q.data) return <p className="text-[12.5px] text-t3">{t("topicFailed")}</p>;
  const p = q.data;
  const linked = new Set(tools.edges.filter((e) => e.target === card.id).map((e) => e.source));
  const onMap = (id: string) => tools.nodes.some((n) => n.id === id);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-[16px] font-semibold text-t1" lang="ar">{p.name}</p>
        {p.source_id === QURANPEDIA && <p className="text-[12px] text-t3">{t("topicCard")}</p>}
        <BoardNotes t={p} />
        <Credits sources={p.sources} />
      </div>
      {p.chain.length > 0 && (
        <section className="flex flex-col gap-1" aria-label={t("topicChain")}>
          <p className="label-caps">{t("topicChain")}</p>
          {p.chain.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 text-[12.5px]" style={{ paddingInlineStart: i * 10 }}>
              <span className="min-w-0 flex-1 truncate" lang="ar">{c.name}</span>
              {c.source_id !== QURANPEDIA && <span className="state-chip">{t("byBoard")}</span>}
              {/* the topic just above this one gathers it */}
              {i === p.chain.length - 1 && tools.editable && (
                <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={onMap(topicCardId(c.id))} onClick={() => tools.addTopic(c, p.sources, { from: card.id, to: topicCardId(c.id) })}>
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
              {(s.source_id !== QURANPEDIA || s.board?.named) && <span className="state-chip">{t("byBoard")}</span>}
              <span className="mono text-[11px] text-t3">{formatNumber(s.verses, locale)}</span>
              {tools.editable && (
                <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={onMap(topicCardId(s.id))} onClick={() => tools.addTopic(s, p.sources, { from: topicCardId(s.id), to: card.id })} aria-label={t("topicAdd", { name: s.name })}>
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
        {p.placed > 0 && <p className="text-[12px] text-t3">{t("topicPlacedCount", cnt(p.placed, locale))}</p>}
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

/** A verse's topics in its Meaning: each with the topic above it and whose link it is, addable as the card the verse
 * is gathered under; then the proper names it names, and the reader's own topics it is in — each list apart. */
export function VerseTopicsList({ tools, card, verseKey }: { tools: CanvasTools; card: GraphNode; verseKey: string }) {
  const t = useTranslations("graph");
  const q = useQuery({ queryKey: ["verse-topics", verseKey], queryFn: () => getJSON<VerseTopics>(`/verses/${verseKey}/topics`), staleTime: 10 * 60_000 });
  const linked = (target: string) => tools.edges.some((e) => e.source === card.id && e.target === target);
  return (
    <>
      {q.data && q.data.data.length > 0 && (
        <section className="flex flex-col gap-1" aria-label={t("verseTopics")}>
          <p className="label-caps">{t("verseTopics")}</p>
          {q.data.data.map((x) => (
            <div key={x.id} className="flex items-center gap-2 text-[12.5px]">
              <span className="min-w-0 flex-1" lang="ar">
                {x.name}
                {x.parent_name && <span className="block text-[11px] text-t3">{x.parent_name}</span>}
                {x.via === "qsac" && <span className="block text-[11px] text-t3">{t("placedFromQsac")}</span>}
              </span>
              {tools.editable && tools.topicLinks && (
                <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={linked(topicCardId(x.id))} onClick={() => tools.addTopic(x, q.data.sources, { from: card.id, to: topicCardId(x.id) })} aria-label={t("topicAdd", { name: x.name })}>
                  {linked(topicCardId(x.id)) ? t("onMap") : "+"}
                </button>
              )}
            </div>
          ))}
          <Credits sources={q.data.sources} />
        </section>
      )}
      <VerseEntitiesList tools={tools} card={card} verseKey={verseKey} />
      <VerseMyTopics tools={tools} card={card} verseKey={verseKey} />
    </>
  );
}

function EntityCredits({ sources }: { sources: Record<string, KnowledgeCredit> }) {
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-0.5">
      {Object.values(sources).map((c) => (
        <p key={c.id} className="text-[11px] leading-relaxed text-t3">
          <a href={c.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{locale === "ar" ? c.attribution_ar : c.attribution_en}</a>
        </p>
      ))}
    </div>
  );
}

/** The library's proper names: the most often named first, or found by name; added at the middle of the view. */
export function EntitySearch({ tools }: { tools: CanvasTools }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const query = q.trim();
  const found = useQuery({
    queryKey: ["entities", query],
    queryFn: () => getJSON<EntityList>(`/entities?${new URLSearchParams(query ? { q: query, limit: "12" } : { limit: "12" })}`),
    staleTime: 10 * 60_000,
  });
  return (
    <section className="library-section" aria-labelledby="lib-entities-h">
      <p id="lib-entities-h" className="label-caps">{t("entitiesTitle")}</p>
      <input className="field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("entitiesSearch")} aria-label={t("entitiesSearch")} dir="auto" />
      {found.data && (
        <>
          <ul className="flex flex-col gap-1">
            {found.data.data.map((x) => {
              const on = tools.nodes.some((n) => n.id === entityCardId(x.id));
              return (
                <li key={x.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="ar-classical min-w-0 flex-1 truncate text-[16px] text-t1" lang="ar">{x.name}</span>
                  <span className="mono text-[11px] text-t3">{formatNumber(x.verses, locale)}</span>
                  <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={on || !tools.editable} onClick={() => tools.addEntity(x)} aria-label={t("entityAdd", { name: x.name })}>
                    {on ? t("onMap") : "+"}
                  </button>
                </li>
              );
            })}
          </ul>
          {found.data.total === 0 && <p className="text-[12px] text-t3">{t("entitiesNone")}</p>}
          <EntityCredits sources={found.data.sources} />
        </>
      )}
    </section>
  );
}

/** A proper name's Meaning: what the corpus tags, the Wikidata item said to be a candidate until reviewed, how many
 * verses name it and how many are on the map. */
export function EntityMeaning({ tools, card }: { tools: CanvasTools; card: GraphNode }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const id = entityOf(card.id)!;
  const q = useQuery({ queryKey: ["entity", id], queryFn: () => getJSON<EntityPage>(`/entities/${id}?limit=500`), staleTime: 10 * 60_000 });
  if (q.isPending) return <p className="text-[12.5px] text-t3">…</p>;
  if (!q.data) return <p className="text-[12.5px] text-t3">{t("topicFailed")}</p>;
  const e = q.data;
  const linked = new Set(tools.edges.filter((x) => x.target === card.id).map((x) => x.source));
  const wd = e.wikidata;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="ar-classical text-[28px] leading-[1.4] text-t1" lang="ar">{e.name}</p>
        <p className="text-[12px] text-t3">{t("entityCard")}</p>
        <p className="text-[11px] text-t3">{entityCredit(locale)}</p>
      </div>
      {wd && (
        <section className="flex flex-col gap-1" aria-label={t("entityWikidataTitle")}>
          <p className="label-caps">{t("entityWikidataTitle")}</p>
          <p className="text-[12.5px] text-t1">
            <a href={`https://www.wikidata.org/wiki/${wd.id}`} target="_blank" rel="noreferrer" className="text-word underline-offset-2 hover:underline" dir="auto">
              {(locale === "ar" ? wd.label_ar ?? wd.label_en : wd.label_en ?? wd.label_ar) ?? wd.id}
            </a>
          </p>
          {wd.description && <p className="text-[12px] text-t2" dir="auto">{wd.description}</p>}
          <p className={"text-[11.5px] " + (e.status === "reviewed" ? "text-good" : "text-amber")}>{t(e.status === "reviewed" ? "entityReviewed" : "entityCandidate")}</p>
        </section>
      )}
      <section className="flex flex-col gap-1" aria-label={t("topicVerses")}>
        <p className="label-caps">{t("topicVerses")}</p>
        <p className="text-[12.5px] text-t2">{t("topicVersesCount", { ...cnt(e.total, locale), on: formatNumber(e.data.filter((v) => linked.has(verseId(v.verse_key))).length, locale) })}</p>
        <p className="text-[11.5px] text-t3">{t("entityByName")}</p>
        {e.total > 0 && tools.editable && (
          <button type="button" className="btn self-start text-[12px]" disabled={!!tools.expanding} onClick={() => tools.addTopicVerses(card.id)}>
            {t("topicAddVerses")}
          </button>
        )}
      </section>
      <EntityCredits sources={e.sources} />
    </div>
  );
}

/** The proper names a verse names, each addable as the heading the verse is gathered under. */
function VerseEntitiesList({ tools, card, verseKey }: { tools: CanvasTools; card: GraphNode; verseKey: string }) {
  const t = useTranslations("graph");
  const q = useQuery({ queryKey: ["verse-entities", verseKey], queryFn: () => getJSON<EntityList>(`/verses/${verseKey}/entities`), staleTime: 10 * 60_000 });
  if (!q.data || !q.data.data.length) return null;
  const linked = (target: string) => tools.edges.some((e) => e.source === card.id && e.target === target);
  return (
    <section className="flex flex-col gap-1" aria-label={t("verseEntities")}>
      <p className="label-caps">{t("verseEntities")}</p>
      {q.data.data.map((x) => (
        <div key={x.id} className="flex items-center gap-2 text-[12.5px]">
          <span className="ar-classical min-w-0 flex-1 text-[16px]" lang="ar">{x.name}</span>
          {tools.editable && tools.topicLinks && (
            <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={linked(entityCardId(x.id))} onClick={() => tools.addEntity(x, { from: card.id, to: entityCardId(x.id) })} aria-label={t("entityAdd", { name: x.name })}>
              {linked(entityCardId(x.id)) ? t("onMap") : "+"}
            </button>
          )}
        </div>
      ))}
      <EntityCredits sources={q.data.sources} />
    </section>
  );
}

/** The reader's own topics (made in the reader's Topic tool) that hold a verse key, with the keys each holds. */
function useMyTopics() {
  const topics = usePersonal((s) => s.topics);
  const verseTopics = usePersonal((s) => s.verseTopics);
  return topics.map((tp) => ({ ...tp, keys: Object.entries(verseTopics).filter(([, ids]) => ids.includes(tp.id)).map(([k]) => k.replace(/^quran:/, "")) }));
}

/** The library's "your topics": the reader's own, each put on the map as their own note with its verses under it —
 * beside the sources' topics, never one of them. */
export function MyTopics({ tools }: { tools: CanvasTools }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const mine = useMyTopics();
  return (
    <section className="library-section" aria-labelledby="lib-mytopics-h">
      <p id="lib-mytopics-h" className="label-caps">{t("myTopicsTitle")}</p>
      <p className="text-[11.5px] leading-relaxed text-t3">{t("myTopicsLead")}</p>
      {mine.length === 0 ? (
        <p className="text-[12px] text-t3">{t("myTopicsNone")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {mine.map((x) => {
            const id = `note:mytopic-${x.id}`;
            const on = tools.nodes.some((n) => n.id === id);
            const all = on && x.keys.every((k) => tools.edges.some((e) => e.source === verseId(k) && e.target === id));
            return (
              <li key={x.id} className="flex items-center gap-2 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate text-t1" dir="auto">{x.label}</span>
                <span className="mono text-[11px] text-t3">{formatNumber(x.keys.length, locale)}</span>
                <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={all || !tools.editable} onClick={() => tools.addMyTopic(x, x.keys)} aria-label={t("myTopicAdd", { name: x.label })}>
                  {all ? t("onMap") : "+"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The reader's own topics that hold this verse, each gathering it under the reader's note — a list apart from the
 * sources'. */
function VerseMyTopics({ tools, card, verseKey }: { tools: CanvasTools; card: GraphNode; verseKey: string }) {
  const t = useTranslations("graph");
  const mine = useMyTopics().filter((x) => x.keys.includes(verseKey));
  if (!mine.length) return null;
  return (
    <section className="flex flex-col gap-1" aria-label={t("verseMyTopics")}>
      <p className="label-caps">{t("myTopicsTitle")}</p>
      {mine.map((x) => {
        const id = `note:mytopic-${x.id}`;
        const done = tools.edges.some((e) => e.source === card.id && e.target === id);
        return (
          <div key={x.id} className="flex items-center gap-2 text-[12.5px]">
            <span className="min-w-0 flex-1" dir="auto">{x.label}</span>
            {tools.editable && tools.topicLinks && (
              <button type="button" className="btn min-h-[26px] px-2 text-[11.5px]" disabled={done} onClick={() => tools.addMyTopic(x, x.keys, verseKey)} aria-label={t("myTopicLink", { name: x.label })}>
                {done ? t("onMap") : "+"}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
