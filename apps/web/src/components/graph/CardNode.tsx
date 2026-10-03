"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, memo, useContext, useState } from "react";
import { Link } from "@/i18n/navigation";
import { citeVerse, cnt, formatNumber } from "@/lib/format";
import { KIND_COLOR, type GraphNode, type VerseExcerpt } from "@/lib/graph/types";
import { excerptOf, useVerseText, wordAt } from "@/lib/graph/verseText";

export type GraphActions = {
  editable: boolean;
  /** the card whose forms or places are being read */
  expanding: string | null;
  toggleFold: (id: string) => void;
  expand: (id: string) => void;
  setText: (id: string, text: string) => void;
};

export const GraphActionsContext = createContext<GraphActions>({
  editable: false,
  expanding: null,
  toggleFold: () => {},
  expand: () => {},
  setText: () => {},
});

const KIND_LABEL = { root: "kindRoot", lemma: "kindLemma", word: "kindWord", verse: "kindVerse", note: "kindNote" } as const;

/**
 * One card anatomy for every node kind (handoff §4.2): type dot + kind label + count on top, the Arabic
 * line as the largest element, a secondary line, then kind-specific content. The colour is the type.
 * Edges enter on the right and leave on the left — the graph reads right to left, like the text.
 */
function CardNodeImpl({ id, data, selected }: NodeProps<GraphNode>) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const actions = useContext(GraphActionsContext);
  const color = KIND_COLOR[data.kind];
  const [draft, setDraft] = useState(data.text ?? "");

  return (
    <div
      className={
        "graph-card w-max max-w-[340px] min-w-[200px] rounded-xl border bg-card text-start shadow-rest " +
        (selected ? "outline-2 outline-offset-2 outline-ring " : "") +
        (data.focus ? "ring-2 ring-ring/50 " : "")
      }
      style={{ borderColor: `color-mix(in srgb, ${color} 35%, var(--line))` }}
      dir="rtl"
    >
      <Handle type="target" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-card" style={{ background: color }} />
      <div className="flex items-center justify-between gap-3 px-3 pt-2.5">
        <span className="flex items-center gap-1.5">
          <span className="dot" style={{ background: color }} />
          <span className="text-[10.5px] font-medium tracking-wide" style={{ color }}>{t(data.kind === "verse" && !data.verse ? "kindPhrase" : KIND_LABEL[data.kind])}</span>
        </span>
        <span className="flex items-center gap-1">
          {data.count != null && <span className="mono text-[11px] text-t3">{formatNumber(data.count, locale)}</span>}
          <button
            type="button"
            className="nodrag flex h-6 w-6 items-center justify-center rounded-md text-t3 hover:bg-card-2"
            aria-label={data.folded ? t("unfold") : t("fold")}
            aria-expanded={!data.folded}
            onClick={() => actions.toggleFold(id)}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className={data.folded ? "" : "rotate-180"}>
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      </div>

      <div className="px-3 pb-3">
        {data.kind === "note" ? (
          actions.editable ? (
            <textarea
              className="nodrag mt-1 min-h-[64px] w-full resize-y rounded-lg border border-line bg-card-2 p-2 text-[14px] outline-none focus:border-ring"
              value={draft}
              placeholder={t("noteHint")}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => draft !== (data.text ?? "") && actions.setText(id, draft)}
              aria-label={t("kindNote")}
            />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-[14px] text-t1">{data.text}</p>
          )
        ) : data.kind === "verse" && data.verse ? (
          <VerseLine verse={data.verse} />
        ) : data.kind === "word" && data.verse?.location ? (
          <WordHead verse={data.verse} />
        ) : (
          <p className={"ar-classical text-[28px] leading-[1.5]" + (data.kind === "root" ? " text-root" : " text-t1")} lang="ar">
            {data.ar}
          </p>
        )}

        {!data.folded && (
          <>
            {data.sub && data.kind !== "note" && (
              <p className={"text-[12px] text-t3 " + (data.kind === "root" ? "" : "ar-classical text-[14px]")} dir={data.kind === "root" ? "ltr" : "rtl"}>
                {data.sub}
              </p>
            )}
            {data.kind === "word" && data.verse && <FirstVerse verse={data.verse} />}
            {data.kind === "verse" && data.verse && <VerseCite verse={data.verse} />}
            {data.kind === "note" && <p className="mt-1 text-[10.5px] text-t3">{t("personalNote")}</p>}
            {data.kind === "root" && (data.usul === "several" || data.usul === "unrelated") && (
              <p className="usul-chip mt-1.5 rounded-md bg-card-2 px-2 py-1 text-[11.5px] leading-relaxed text-t2" data-usul={data.usul}>
                {t(data.usul === "unrelated" ? "usulUnrelatedCard" : "usulSeveralCard")}
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.more && data.more.remaining > 0 && (
                <button type="button" className="nodrag btn min-h-[26px] px-2 text-[11.5px]" onClick={() => actions.expand(id)} disabled={!!actions.expanding} aria-busy={actions.expanding === id}>
                  {data.more.kind === "forms"
                    ? t("moreForms", cnt(data.more.remaining, locale))
                    : t("moreVerses", cnt(data.more.remaining, locale))}
                </button>
              )}
              {data.kind === "word" && !data.expanded && data.count != null && data.count > 0 && (
                <button type="button" className="nodrag btn min-h-[26px] px-2 text-[11.5px]" onClick={() => actions.expand(id)} disabled={!!actions.expanding} aria-busy={actions.expanding === id}>
                  {t("showVerses", { n: formatNumber(data.count, locale) })}
                </button>
              )}
              {data.kind === "root" && data.rootKey && (
                <Link href={`/roots/${encodeURIComponent(data.rootKey)}`} className="nodrag btn min-h-[26px] px-2 text-[11.5px]">
                  {t("openRoot")}
                </Link>
              )}
              {(data.kind === "word" || data.kind === "verse") && data.verse?.location && (
                <Link
                  href={`/word/${data.verse.location}`}
                  className="nodrag btn min-h-[26px] px-2 text-[11.5px]"
                >
                  {t("openReader")}
                </Link>
              )}
            </div>
          </>
        )}
      </div>
      <Handle type="source" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-card" style={{ background: color }} />
    </div>
  );
}

export const CardNode = memo(CardNodeImpl);

/** The verse's words around the place, drawn from the dataset, every cut marked «…» (law L1; P8.0 F3). */
function Excerpted({ verse, className, wordClass, around = 5 }: { verse: VerseExcerpt; className: string; wordClass: string; around?: number }) {
  const t = useTranslations("graph");
  const v = useVerseText(verse.key);
  if (v.isPending) return <span className="mt-1 block h-6 animate-pulse rounded bg-card-2" aria-hidden="true" />;
  if (!v.data) return <p className="mt-1 text-[12px] text-t3">{t("verseUnavailable")}</p>;
  const x = excerptOf(v.data, verse.location, around);
  return (
    <p className={className} lang="ar">
      {x.cutLeft && <span className="text-t3">… </span>}
      <span className="text-t2">{x.left}</span>
      {x.word && (
        <>
          {" "}
          <mark className={wordClass}>{x.word}</mark>{" "}
        </>
      )}
      <span className="text-t2">{x.right}</span>
      {x.cutRight && <span className="text-t3"> …</span>}
    </p>
  );
}

function VerseLine({ verse }: { verse: VerseExcerpt }) {
  return <Excerpted verse={verse} className="quran mt-1 text-[19px] leading-[2.1] text-t1" wordClass="rounded bg-sentence-wash px-0.5 text-t1" />;
}

/** A word card's headline: the word as the mushaf writes it at its place, from the dataset. */
function WordHead({ verse }: { verse: VerseExcerpt }) {
  const v = useVerseText(verse.key);
  const word = v.data && verse.location ? wordAt(v.data, verse.location) : null;
  if (v.isPending) return <span className="mt-1 block h-10 w-24 animate-pulse rounded bg-card-2" aria-hidden="true" />;
  return (
    <p className="quran text-[30px] leading-[1.8] text-t1" lang="ar">
      {word ?? "—"}
    </p>
  );
}

function VerseCite({ verse }: { verse: VerseExcerpt }) {
  const locale = useLocale();
  const v = useVerseText(verse.key);
  if (!v.data) return null;
  return <p className="mt-1 text-[11.5px] text-t3">{citeVerse(v.data.surah_name_ar, v.data.surah, v.data.ayah, locale, v.data.surah_name_translit)}</p>;
}

function FirstVerse({ verse }: { verse: VerseExcerpt }) {
  const t = useTranslations("graph");
  return (
    <div className="mt-2 rounded-lg bg-card-2 px-2 py-1.5">
      <p className="text-[10.5px] text-t3">{t("firstVerse")}</p>
      <Excerpted verse={verse} around={3} className="quran text-[16px] leading-[2]" wordClass="bg-transparent text-word" />
      <VerseCite verse={verse} />
    </div>
  );
}
