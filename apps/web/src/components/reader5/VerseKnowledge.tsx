"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { cnt, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { EditorNote, KnowledgeSource, VerseKnowledge as VK } from "@/lib/reader/types";

export function useVerseKnowledge(key: string) {
  return useQuery({ queryKey: ["verse-knowledge", key], queryFn: () => getJSON<VK>(`/verses/${key}/knowledge`), staleTime: Infinity });
}

const PLACE_KEYS = new Set(["medina", "mecca", "juhfa", "between-mecca-and-medina", "arafat", "hijra-journey", "mina", "hudaybiyya-return"]);

/** A layer section of verse mode: the same card as the word entry's layers, open by default. */
export function VerseLayer({ title, meta, children, defaultOpen = true }: { title: string; meta?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="layer">
      <button type="button" className="layer-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="text-[13.5px] font-medium text-t1">{title}</span>
        {meta && <span className="text-[11.5px] text-t3">{meta}</span>}
        <span className="flex-1" />
        <span className="layer-chev" aria-hidden="true">▾</span>
      </button>
      {open && <div className="layer-body">{children}</div>}
    </section>
  );
}

export function SourceCredit({ s }: { s: KnowledgeSource | undefined }) {
  const locale = useLocale();
  if (!s) return null;
  return (
    <p className="text-[11px] leading-relaxed text-t3">
      <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-t1 hover:underline">
        {locale === "ar" ? s.attribution_ar : s.attribution_en}
      </a>
      {s.license_url && (
        <>
          {" · "}
          <a href={s.license_url} target="_blank" rel="noreferrer license" className="underline-offset-2 hover:text-t1 hover:underline">
            {locale === "ar" && s.license_ar ? s.license_ar : s.license}
          </a>
        </>
      )}
    </p>
  );
}

/** The editors' apparatus separated from the text, offered on request (never deleted). */
export function EditorNotes({ notes }: { notes: EditorNote[] | null }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  if (!notes?.length) return null;
  return (
    <details className="kn-notes">
      <summary>{t("editorNotes", { n: formatNumber(notes.length, locale) })}</summary>
      <ol>
        {notes.map((n, i) => (
          <li key={i} className="ar-classical text-[13.5px] leading-[1.9] text-t2" lang="ar" dir="rtl">
            {n.text}
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Long verbatim text, folded to a few lines until asked. */
export function Fold({ text, lines = 6, className = "" }: { text: string; lines?: number; className?: string }) {
  const t = useTranslations("rd");
  const [open, setOpen] = useState(false);
  const long = text.length > lines * 90;
  return (
    <div className="flex flex-col gap-1">
      <div className={"kn-text " + className} data-folded={long && !open ? "true" : undefined} style={{ ["--lines" as string]: lines }} lang="ar" dir="rtl">
        {text}
      </div>
      {long && (
        <button type="button" className="self-start text-[11.5px] text-t3 hover:text-t1" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? t("showLess") : t("readAll")}
        </button>
      )}
    </div>
  );
}

/**
 * What the knowledge layers hold for a verse (P2.5a with P3.9): occasions of revelation from three
 * works, where it was revealed, the verses Ibn Kathīr cites to explain it and the verses whose
 * explanation cites it, and the people and places it names. All verbatim, attributed, unreviewed.
 */
export function VerseKnowledgeSections({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const q = useVerseKnowledge(verseKey);
  if (!q.data) return <div className="h-24 animate-pulse rounded-xl bg-card-2" role="status" aria-label={t("loading")} />;
  const k = q.data;
  const named = k.entities.filter((e) => e.wikidata_id);
  return (
    <>
      <VerseLayer title={t("secAsbab")} meta={k.asbab.length ? t("narrationsN", { n: formatNumber(k.asbab.length, locale) }) : undefined}>
        {k.asbab.length === 0 ? (
          <p className="text-[12.5px] text-t3">{t("asbabNone")}</p>
        ) : (
          k.asbab.map((a) => (
            <article key={a.id} className="kn-item">
              <p className="text-[11.5px] font-medium text-t2">{t(`work_${a.work}`)}{a.heading ? <span className="font-normal text-t3"> · {a.heading.replace(/\s+/g, " ").slice(0, 80)}</span> : null}</p>
              <Fold text={a.text} className="ar-classical text-[15px] leading-[2]" />
              {a.takhrij && (
                <details className="kn-notes">
                  <summary>{t("takhrij")}</summary>
                  <p className="ar-classical text-[13.5px] leading-[1.9] text-t2" lang="ar" dir="rtl">{a.takhrij}</p>
                </details>
              )}
              <EditorNotes notes={a.notes} />
              {a.confidence && a.confidence !== "high" && <p className="text-[11px] text-amber">{t("keyedApprox")}</p>}
              <SourceCredit s={k.sources[a.source_id]} />
            </article>
          ))
        )}
      </VerseLayer>

      {k.places.length > 0 && (
        <VerseLayer title={t("secPlace")} defaultOpen={false} meta={t("notesN", { n: formatNumber(k.places.length, locale) })}>
          {k.places.map((p) => (
            <article key={p.id} className="kn-item">
              <p className="text-[11.5px] font-medium text-t2">
                {t(`placeRole_${p.role}`)}
                {p.scope === "surah" && <span className="font-normal text-t3"> · {t("wholeSurah")}</span>}
                {p.attributed_to && <span className="font-normal text-t3"> · {p.attributed_to}</span>}
              </p>
              {p.role === "source-note" ? (
                <>
                  <p className="text-[13px] text-t1">
                    {[p.place && PLACE_KEYS.has(p.place) ? t(`place_${p.place.replace(/-/g, "_")}`) : null, p.period ? t(`period_${p.period}`) : null].filter(Boolean).join(" · ")}
                    {p.ayah_from !== p.ayah_to ? ` (${formatNumber(p.ayah_from, locale)}–${formatNumber(p.ayah_to, locale)})` : ""}
                  </p>
                  <p className="text-[12px] italic text-t3" lang="en" dir="ltr">“{p.quote}”</p>
                </>
              ) : (
                <Fold text={p.quote} lines={4} className="ar-classical text-[14.5px] leading-[1.95]" />
              )}
              <SourceCredit s={k.sources[p.source_id]} />
            </article>
          ))}
        </VerseLayer>
      )}

      <VerseLayer title={t("secCites")} meta={k.cites.length ? t("versesN", { n: formatNumber(k.cites.length, locale) }) : undefined} defaultOpen={false}>
        <p className="text-[11.5px] text-t3">{t("citesLead")}</p>
        {k.cites.length === 0 ? (
          <p className="text-[12.5px] text-t3">{t("citesNone")}</p>
        ) : (
          <ul className="flex flex-col">
            {k.cites.map((c, i) => (
              <li key={i} className="kn-cite">
                <Link href={`/quran/${c.to.surah}/${c.to.ayah}`} className="mono text-[11.5px] text-word hover:underline" dir="ltr">
                  {c.to.key}
                  {c.to_end.key !== c.to.key ? `–${c.to_end.ayah}` : ""}
                </Link>
                <span className="text-[11.5px] text-t3">{c.to.name_ar}</span>
                {c.quote && <span className="kn-quote ar-classical" lang="ar" dir="rtl">﴿{c.quote}﴾</span>}
                {c.confidence !== "high" && <span className="text-[10.5px] text-amber">{t("keyedApprox")}</span>}
              </li>
            ))}
          </ul>
        )}
        {k.cited_by.length > 0 && (
          <>
            <p className="label-caps mt-1">{t("secCitedBy")}</p>
            <div className="flex flex-wrap gap-1.5">
              {k.cited_by.map((c) => (
                <Link key={c.from.key} href={`/quran/${c.from.surah}/${c.from.ayah}`} className="chip" title={c.from.name_ar}>
                  <span className="mono text-[11px]" dir="ltr">{c.from.key}</span>
                </Link>
              ))}
            </div>
          </>
        )}
        <SourceCredit s={k.sources["ibn-kathir-crossrefs"]} />
      </VerseLayer>

      {named.length > 0 && (
        <VerseLayer title={t("secEntities")} defaultOpen={false}>
          <ul className="flex flex-col gap-1.5">
            {named.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="ar-classical text-[17px]" lang="ar">{e.name_ar}</span>
                <span className="text-[12px] text-t2">{locale === "ar" ? e.wikidata_label_ar ?? e.wikidata_label_en : e.wikidata_label_en ?? e.wikidata_label_ar}</span>
                <span className="text-[11px] text-t3">{t("inQuranCount", cnt(e.occurrences, locale))}</span>
                <a href={`https://www.wikidata.org/wiki/${e.wikidata_id}`} target="_blank" rel="noreferrer" className="text-[11px] text-word hover:underline">
                  {t("onWikidata")}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-amber">{t("entityCandidate")}</p>
          <SourceCredit s={k.sources["qac-proper-nouns"]} />
          <SourceCredit s={k.sources["wikidata"]} />
        </VerseLayer>
      )}
      <p className="text-[11px] text-t3">{t("extractedNote")}</p>
    </>
  );
}
