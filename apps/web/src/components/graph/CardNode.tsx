"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, memo, useContext, useState } from "react";
import { Link } from "@/i18n/navigation";
import { citeVerse, cnt, formatNumber } from "@/lib/format";
import { META } from "@/lib/graph/relations";
import { KIND_COLOR, type GraphNode } from "@/lib/graph/types";
import { excerptOf, keyOf, markedVerse, useVerseText } from "@/lib/graph/verseText";

export type GraphActions = {
  editable: boolean;
  /** transliteration shown on the cards (QAN-22) */
  translit: boolean;
  /** the card whose places are being read */
  expanding: string | null;
  toggleFold: (id: string) => void;
  expand: (id: string) => void;
  setText: (id: string, text: string) => void;
};

export const GraphActionsContext = createContext<GraphActions>({
  editable: false,
  translit: false,
  expanding: null,
  toggleFold: () => {},
  expand: () => {},
  setText: () => {},
});

/**
 * One card anatomy for every kind (handoff §4.2): type dot + kind label + count on top, the Arabic line as the
 * largest element, a secondary line, then what the kind holds. The colour is the type (QAN-01: a root, a pattern
 * «وزن», a word «كلمة» — the lemma — a verse, a note). Links enter on the right and leave on the left — the graph
 * reads right to left, like the text.
 */
function CardNodeImpl({ id, data, selected }: NodeProps<GraphNode>) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const actions = useContext(GraphActionsContext);
  const color = KIND_COLOR[data.kind];
  const [draft, setDraft] = useState(data.text ?? "");
  const meta = META[data.kind];
  const busy = !!actions.expanding;

  return (
    <div
      className={
        "graph-card w-max max-w-[340px] min-w-[200px] rounded-xl border bg-card text-start shadow-rest " +
        (selected ? "outline-2 outline-offset-2 outline-ring " : "") +
        (data.focus ? "ring-2 ring-ring/50 " : "") +
        (data.reading ? "is-reading " : "")
      }
      style={{ borderColor: data.reading ? "var(--amber)" : `color-mix(in srgb, ${color} 35%, var(--line))` }}
      dir="rtl"
    >
      <Handle type="target" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-card" style={{ background: color }} />
      <div className="flex items-center justify-between gap-3 px-3 pt-2.5">
        <span className="flex items-center gap-1.5" title={t(meta.hint)}>
          <span className="dot" style={{ background: color }} />
          <span className="text-[10.5px] font-medium tracking-wide" style={{ color }}>{t(data.phrase ? "kindPhrase" : meta.label)}</span>
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
        {data.kind === "note" && data.phrase ? (
          <p className="ar-classical mt-1 text-[22px] leading-[1.6] text-t1" lang="ar">{data.text}</p>
        ) : data.kind === "note" ? (
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
          <VerseLine verseKey={data.verse.key} places={data.places ?? []} />
        ) : (
          <p className={"ar-classical text-[28px] leading-[1.5] " + (data.kind === "root" ? "text-root" : data.kind === "pattern" ? "text-form" : "text-t1")} lang="ar">
            {data.ar}
          </p>
        )}

        {!data.folded && (
          <>
            {data.sub && data.kind !== "note" && (actions.translit || (data.kind !== "root" && data.kind !== "pattern")) && (
              <p
                className={"text-[12px] text-t3 " + (data.kind === "root" || data.kind === "pattern" ? "" : "ar-classical text-[14px]")}
                dir={data.kind === "root" || data.kind === "pattern" ? "ltr" : "rtl"}
              >
                {data.sub}
              </p>
            )}
            {data.kind === "lemma" && data.forms && data.forms.length > 0 && (
              <p className="mt-1 text-[12px] text-t3">
                <span className="sr-only">{t("formsLabel")}: </span>
                {data.forms.map((f, i) => (
                  <span key={f.form}>
                    {i > 0 && " · "}
                    <span className="ar-classical text-[14px] text-t2" lang="ar">{f.form}</span> <span className="mono text-[10.5px]">{formatNumber(f.count, locale)}</span>
                  </span>
                ))}
              </p>
            )}
            {data.kind === "lemma" && data.first && <FirstVerse place={data.first} />}
            {data.kind === "verse" && data.verse && <VerseCite verseKey={data.verse.key} />}
            {data.kind === "note" && !data.phrase && <p className="mt-1 text-[10.5px] text-t3">{t("personalNote")}</p>}
            {data.reading && (
              <p className="reading-chip mt-1.5" title={t("readingHint")}>
                {t("readingChip", { conf: new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(data.reading.conf) })}
              </p>
            )}
            {data.kind === "root" && (data.usul === "several" || data.usul === "unrelated") && (
              <p className="usul-chip mt-1.5 rounded-md bg-card-2 px-2 py-1 text-[11.5px] leading-relaxed text-t2" data-usul={data.usul}>
                {t(data.usul === "unrelated" ? "usulUnrelatedCard" : "usulSeveralCard")}
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.kind === "lemma" && data.slug && !data.expanded && data.count != null && data.count > 0 && (
                <button type="button" className="nodrag btn min-h-[26px] px-2 text-[11.5px]" onClick={() => actions.expand(id)} disabled={busy} aria-busy={actions.expanding === id}>
                  {t("showVerses", { n: formatNumber(data.count, locale) })}
                </button>
              )}
              {data.more && data.more.remaining > 0 && (
                <button type="button" className="nodrag btn min-h-[26px] px-2 text-[11.5px]" onClick={() => actions.expand(id)} disabled={busy} aria-busy={actions.expanding === id}>
                  {t("moreVerses", cnt(data.more.remaining, locale))}
                </button>
              )}
              {data.kind === "root" && data.rootKey && (
                <Link href={`/roots/${encodeURIComponent(data.rootKey)}`} className="nodrag btn min-h-[26px] px-2 text-[11.5px]">
                  {t("openRoot")}
                </Link>
              )}
              {data.kind === "lemma" && data.first && (
                <Link href={`/word/${data.first}`} className="nodrag btn min-h-[26px] px-2 text-[11.5px]">
                  {t("openReader")}
                </Link>
              )}
              {data.kind === "verse" && data.verse && (
                <Link href={data.places?.length === 1 ? `/word/${data.places[0]}` : `/quran/${data.verse.key.replace(":", "/")}`} className="nodrag btn min-h-[26px] px-2 text-[11.5px]">
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

/** A frame: a group of cards with a title and nothing else (QAN-01 «مجموعة»); its tools come with P8.1-C. */
function FrameNodeImpl({ data, selected }: NodeProps<GraphNode>) {
  const t = useTranslations("graph");
  const size = data.size ?? { w: 420, h: 280 };
  return (
    <div
      className={"graph-frame rounded-2xl border-2 border-dashed " + (selected ? "border-ring" : "border-line")}
      style={{ width: size.w, height: size.h }}
      dir="rtl"
    >
      <p className="px-3 pt-2 text-[12px] font-medium text-t2">{data.title || t("kindFrame")}</p>
    </div>
  );
}

export const FrameNode = memo(FrameNodeImpl);

/** The verse's words, drawn from the dataset: around its one marked place, every cut marked «…», or whole with
 * every place marked (law L1; P8.0 F3). */
function Excerpted({ verseKey, places, className, wordClass, around = 5 }: { verseKey: string; places: string[]; className: string; wordClass: string; around?: number }) {
  const t = useTranslations("graph");
  const v = useVerseText(verseKey);
  if (v.isPending) return <span className="mt-1 block h-6 animate-pulse rounded bg-card-2" aria-hidden="true" />;
  if (!v.data) return <p className="mt-1 text-[12px] text-t3">{t("verseUnavailable")}</p>;
  if (places.length > 1)
    return (
      <p className={className} lang="ar">
        {markedVerse(v.data, places).map((s, i) => (
          <span key={i}>
            {i > 0 && " "}
            {s.marked ? <mark className={wordClass}>{s.text}</mark> : <span className="text-t2">{s.text}</span>}
          </span>
        ))}
      </p>
    );
  const x = excerptOf(v.data, places[0], around);
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

function VerseLine({ verseKey, places }: { verseKey: string; places: string[] }) {
  return <Excerpted verseKey={verseKey} places={places} className="quran mt-1 text-[19px] leading-[2.1] text-t1" wordClass="rounded bg-sentence-wash px-0.5 text-t1" />;
}

function VerseCite({ verseKey }: { verseKey: string }) {
  const locale = useLocale();
  const v = useVerseText(verseKey);
  if (!v.data) return null;
  return <p className="mt-1 text-[11.5px] text-t3">{citeVerse(v.data.surah_name_ar, v.data.surah, v.data.ayah, locale, v.data.surah_name_translit)}</p>;
}

/** A word's first occurrence, the word marked in its verse. */
function FirstVerse({ place }: { place: string }) {
  const t = useTranslations("graph");
  return (
    <div className="mt-2 rounded-lg bg-card-2 px-2 py-1.5">
      <p className="text-[10.5px] text-t3">{t("firstVerse")}</p>
      <Excerpted verseKey={keyOf(place)} places={[place]} around={3} className="quran text-[16px] leading-[2]" wordClass="bg-transparent text-word" />
      <VerseCite verseKey={keyOf(place)} />
    </div>
  );
}

