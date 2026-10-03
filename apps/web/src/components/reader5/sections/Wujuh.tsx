"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { cnt, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { Contrast, RelationSource, WordPayload, WordRelations, WujuhEntry } from "@/lib/reader/types";
import { Fold } from "../VerseKnowledge";
import { showHemistichs } from "@/lib/openiti";

export function useWordRelations(slug: string, at: string | null) {
  return useQuery({
    queryKey: ["word-relations", slug, at],
    queryFn: () => getJSON<WordRelations>(`/words/${encodeURIComponent(slug)}/relations${at ? `?at=${at}` : ""}`),
    staleTime: Infinity,
  });
}

function pageRef(vol: number | null, page: number | null, locale: string): string {
  if (!page) return "";
  return locale === "ar" ? `ج${formatNumber(vol ?? 1, locale)} ص${formatNumber(page, locale)}` : `vol. ${vol ?? 1}, p. ${page}`;
}

function SourceLine({ s, vol, page }: { s: RelationSource | undefined; vol: number | null; page: number | null }) {
  const locale = useLocale();
  if (!s) return null;
  const died = s.death_hijri ? (locale === "ar" ? ` (ت ${formatNumber(s.death_hijri, locale)}هـ)` : ` (d. ${s.death_ce ?? ""})`) : "";
  return (
    <p className="text-[11px] text-t3">
      {locale === "ar" ? `${s.author_ar.split("،")[0]}${died}، ${s.title_ar}` : `${s.author_en}${died}, ${s.title_en}`}
      {page ? ` · ${pageRef(vol, page, locale)}` : ""}
    </p>
  );
}

function VerseChips({ verses, here }: { verses: string[]; here: string | null }) {
  return (
    <span className="flex flex-wrap gap-1">
      {verses.map((k) => {
        const [s, a] = k.split(":");
        return (
          <Link key={k} href={`/quran/${s}/${a}`} className={"verse-chip" + (k === here ? " is-here" : "")} dir="ltr">
            {k}
          </Link>
        );
      })}
    </span>
  );
}

function Entry({ e, src, here }: { e: WujuhEntry; src: RelationSource | undefined; here: string | null }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [open, setOpen] = useState(e.senses.some((s) => s.cites_here) || e.scope !== "other-lemma");
  return (
    <div className="wujuh-entry">
      <button type="button" className="wujuh-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="ar-classical text-[16px] text-t1" lang="ar">{e.heading_ar.replace(/^\(|\)$/g, "")}</span>
        <span className="text-[11.5px] text-t3">{t("nSenses", cnt(e.senses.length, locale))}</span>
        <span className="flex-1" />
        <span className="layer-chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <SourceLine s={src} vol={e.page_vol} page={e.page} />
          <ol className="flex flex-col gap-2">
            {e.senses.map((s) => (
              <li key={s.id} className={"wujuh-sense" + (s.cites_here ? " is-here" : "")}>
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="mono text-[11px] text-t3">{formatNumber(s.sense_index, locale)}</span>
                  {s.sense_label_ar && <strong className="ar-classical text-[16px] font-bold text-t1" lang="ar">{s.sense_label_ar}</strong>}
                  {s.cites_here && <span className="tag-pill is-here">{t("citesHere")}</span>}
                </p>
                <Fold text={showHemistichs(s.text_ar)} lines={3} className="ar-classical text-[14.5px] leading-[1.95] text-t2" />
                {s.verses.length > 0 && <VerseChips verses={s.verses} here={here} />}
              </li>
            ))}
          </ol>
          {e.match_confidence && e.match_confidence !== "high" && <p className="text-[11px] text-amber">{t("matchedApprox")}</p>}
        </>
      )}
    </div>
  );
}

function ContrastList({ items, sources, title, lead }: { items: Contrast[]; sources: Record<string, RelationSource>; title: string; lead: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, 4);
  return (
    <div className="flex flex-col gap-2">
      <p className="label-caps">{title}</p>
      <p className="text-[11.5px] text-t3">{lead}</p>
      {shown.map((c) => (
        <div key={c.id} className="wujuh-sense">
          <p className="ar-classical text-[15px] font-bold text-t1" lang="ar">{c.heading_ar ?? `${c.headword_ar}${c.target_ar ? ` / ${c.target_ar}` : ""}`}</p>
          <Fold text={showHemistichs(c.text_ar)} lines={3} className="ar-classical text-[14.5px] leading-[1.95] text-t2" />
          <SourceLine s={sources[c.source_id]} vol={c.page_vol} page={c.page} />
        </div>
      ))}
      {items.length > 4 && (
        <button type="button" className="self-start text-[11.5px] text-t3 hover:text-t1" onClick={() => setAll(!all)}>
          {all ? t("showLess") : t("allN", { n: formatNumber(items.length, locale) })}
        </button>
      )}
    </div>
  );
}

/**
 * The classical wujūh literature (P3.1): how many senses a Quranic word carries and which verses
 * illustrate each — Ibn al-Jawzī's Nuzhat al-aʿyun and al-Dāmaghānī's Qāmūs, verbatim, with page
 * references; the sense whose verses include this occurrence is marked. Then al-ʿAskarī's furūq and
 * Ibn al-Anbārī's aḍdād for the root. Extracted, not yet reviewed (L3).
 */
export function WujuhBlock({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const at = w.occurrence?.location ?? null;
  const here = at ? at.split(":").slice(0, 2).join(":") : null;
  const q = useWordRelations(w.slug, at);
  if (!q.data) return null;
  const r = q.data;
  const main = r.wujuh.filter((e) => e.scope !== "other-lemma");
  const other = r.wujuh.filter((e) => e.scope === "other-lemma");
  if (!r.wujuh.length && !r.furuq.length && !r.addad.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {r.wujuh.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="label-caps">{t("secWujuh")}</p>
          <p className="text-[11.5px] text-t3">{t("wujuhLead")}</p>
          {main.map((e) => (
            <Entry key={e.id} e={e} src={r.sources[e.source_id]} here={here} />
          ))}
          {other.length > 0 && (
            <>
              <p className="text-[11.5px] text-t3">{t("wujuhOther")}</p>
              {other.map((e) => (
                <Entry key={e.id} e={e} src={r.sources[e.source_id]} here={here} />
              ))}
            </>
          )}
        </div>
      )}
      <ContrastList items={r.furuq} sources={r.sources} title={t("secFuruq")} lead={t("furuqLead")} />
      <ContrastList items={r.addad} sources={r.sources} title={t("secAddad")} lead={t("addadLead")} />
      <p className="text-[11px] text-t3">{t("extractedNote")}</p>
    </div>
  );
}
