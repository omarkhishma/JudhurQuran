"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Term } from "@/components/terms/Term";
import { Segmented } from "@/components/ui/Segmented";
import { cnt, cnt2, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { useReader } from "@/lib/reader/store";
import { FORM_TERM } from "@/lib/terms";
import type { ClassicalRow, ClassicalSource, LemmaLite, PatternInfo, WordPayload } from "@/lib/reader/types";
import { CreditLine } from "../CreditLine";
import { PatternFunction, WordChip } from "./Family";

// The closed list the root table checks against (RDR-227, 228, adapted): the ten derived-verb forms of
// the sarf books — which of them a root takes in the Quran is worth knowing, and so is which it does not.
// Noun patterns are an open set and are listed only where attested.
const VERB_FORMS: { n: number; ar: string; tr: string }[] = [
  { n: 1, ar: "فَعَلَ", tr: "faʿala" },
  { n: 2, ar: "فَعَّلَ", tr: "faʿʿala" },
  { n: 3, ar: "فَاعَلَ", tr: "fāʿala" },
  { n: 4, ar: "أَفْعَلَ", tr: "afʿala" },
  { n: 5, ar: "تَفَعَّلَ", tr: "tafaʿʿala" },
  { n: 6, ar: "تَفَاعَلَ", tr: "tafāʿala" },
  { n: 7, ar: "انْفَعَلَ", tr: "infaʿala" },
  { n: 8, ar: "افْتَعَلَ", tr: "iftaʿala" },
  { n: 9, ar: "افْعَلَّ", tr: "ifʿalla" },
  { n: 10, ar: "اسْتَفْعَلَ", tr: "istafʿala" },
];

/** Shapes (design 03 §3.5.3, RDR-226…232): the root's patterns with every family word on each (the
 * prototype showed one per pattern, RDR-229), the verb forms it does not take on request, and a pattern's
 * words across roots or in this sūra. The view and the last pattern chosen live in the reader's state, so
 * the shape door and the omnibox can open it on a pattern (RDR-332, 377). */
export function ShapesSection({ w, chapter }: { w: WordPayload; chapter: number }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const view = useReader((s) => s.shapesView);
  const chosen = useReader((s) => s.shapesPattern);
  const setShapes = useReader((s) => s.setShapes);
  const [showAll, setShowAll] = useState(false);
  const picked = chosen ?? w.pattern?.slug ?? null;
  const groups = w.family.filter((g) => g.pattern);
  const forms = new Set(groups.map((g) => g.pattern!.form_number).filter((n): n is number => n != null));
  const verbs = groups.filter((g) => g.pattern!.form_number != null);
  const nouns = groups.filter((g) => g.pattern!.form_number == null);
  const row = (g: (typeof groups)[number]) => (
    <tr key={g.pattern!.slug}>
      <td>
        <button
          type="button"
          className="ar-classical text-[18px] text-form hover:underline"
          lang="ar"
          onClick={() => setShapes({ view: "pattern", pattern: g.pattern!.slug })}
          title={t("everyWordOnPattern")}
        >
          {g.pattern!.ar.full}
        </button>
        <span className="mono block text-[10.5px] text-t3" dir="ltr">{g.pattern!.ar.translit}</span>
      </td>
      <td className="text-[11.5px] text-t2"><PatternFunction p={g.pattern!} /></td>
      <td>
        <div className="flex flex-wrap gap-1">
          {g.members.map((m) => (
            <WordChip key={m.slug} m={m} current={m.slug === w.slug} />
          ))}
        </div>
      </td>
    </tr>
  );
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label={t("secShapes")}
        value={view}
        onChange={(v) => setShapes({ view: v })}
        options={[
          { value: "root", label: t("thisRoot") },
          { value: "pattern", label: t("thisPattern") },
        ]}
      />
      {view === "root" ? (
        <>
          {w.root && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="ar-classical text-[28px] tracking-[.06em] text-root" lang="ar">{w.root.ar_spaced}</span>
              <span className="mono text-[11.5px] text-t3" dir="ltr">{w.root.translit}</span>
              <span className="text-[12px] text-t2">{t("verbFormsAttested", { k: formatNumber(forms.size, locale), n: formatNumber(VERB_FORMS.length, locale) })}</span>
              {nouns.length > 0 && <span className="text-[12px] text-t2">{t("nounPatternsN", cnt(nouns.length, locale))}</span>}
            </div>
          )}
          <table className="shapes-table">
            <tbody>
              {showAll
                ? VERB_FORMS.map((f) => {
                    const gs = verbs.filter((g) => g.pattern!.form_number === f.n);
                    if (gs.length) return gs.map(row);
                    return (
                      <tr key={`form-${f.n}`} className="is-unattested">
                        <td>
                          <span className="ar-classical text-[18px] text-form" lang="ar">{f.ar}</span>
                          <span className="mono block text-[10.5px] text-t3" dir="ltr">{f.tr}</span>
                        </td>
                        <td className="text-[11.5px] text-t2">
                          {FORM_TERM[f.n] ? <Term id={FORM_TERM[f.n]!}>{t("formN", { n: formatNumber(f.n, locale) })}</Term> : t("formN", { n: formatNumber(f.n, locale) })}
                        </td>
                        <td>
                          <em className="text-[12px] text-t3">{t("notAttested")}</em>
                        </td>
                      </tr>
                    );
                  })
                : verbs.map(row)}
              {nouns.map(row)}
            </tbody>
          </table>
          {w.root && (
            <button type="button" className="self-start text-[12px] text-t2 underline-offset-2 hover:underline" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? t("hideUnattested") : t("showAllForms", { n: formatNumber(VERB_FORMS.length, locale) })}
            </button>
          )}
        </>
      ) : (
        <PatternView slug={picked} current={w.slug} chapter={chapter} />
      )}
    </div>
  );
}

type PatternPayload = PatternInfo & {
  members: (LemmaLite & { root: { key: string; ar_spaced: string } | null })[];
  classical: { rows: ClassicalRow[]; sources: ClassicalSource[] };
};

function PatternView({ slug, current, chapter }: { slug: string | null; current: string; chapter: number }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [scope, setScope] = useState<"all" | "surah">("all");
  const [all, setAll] = useState(false);
  const q = useQuery({ queryKey: ["pattern", slug, "all"], queryFn: () => getJSON<PatternPayload>(`/patterns/${slug}?limit=5000`), enabled: !!slug });
  // the sūra's words, to show the pattern's words that occur here (RDR-231)
  const sets = useQuery({ queryKey: ["lemma-sets"], queryFn: () => getJSON<{ data: Record<string, string[]> }>("/surahs/lemma-sets"), enabled: scope === "surah", staleTime: Infinity });
  if (!slug) return <p className="text-[13px] text-t3">{t("noPattern")}</p>;
  if (!q.data) return <div className="h-20 animate-pulse rounded-xl bg-card-2" />;
  const p = q.data;
  const here = new Set(sets.data?.data[String(chapter)] ?? []);
  const members = scope === "surah" ? p.members.filter((m) => here.has(m.slug)) : p.members;
  const shown = all ? members : members.slice(0, 60);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="ar-classical text-[36px] text-form" lang="ar">{p.ar.full}</span>
        <span className="mono text-[12px] text-t3" dir="ltr">{p.ar.translit}</span>
      </div>
      <p className="text-[12.5px] text-t2">
        <PatternFunction p={p} /> — {t("patternSpread", { ...cnt(p.lemma_count, locale), ...cnt2(p.occurrences, locale) })}
      </p>
      {p.classical.rows.length > 0 && <Classical rows={p.classical.rows} sources={p.classical.sources} />}
      <Segmented
        label={t("patternScope")}
        value={scope}
        onChange={setScope}
        options={[
          { value: "all", label: t("allRootsScope") },
          { value: "surah", label: t("inThisSurah") },
        ]}
      />
      {scope === "surah" && sets.data && members.length === 0 && <p className="text-[12.5px] text-t3">{t("noneInSurah")}</p>}
      <ul className="long-list flex flex-col divide-y divide-line">
        {shown.map((m) => (
          <li key={m.slug} className={"flex items-center gap-3 py-1.5" + (m.slug === current ? " is-current-row" : "")} aria-current={m.slug === current || undefined}>
            <WordChip m={m} current={m.slug === current} />
            <span className="min-w-0 flex-1 truncate text-[12px] text-t2" lang="en">{m.gloss_en ?? ""}</span>
            {m.root && <span className="ar-classical text-[15px] text-root" lang="ar">{m.root.ar_spaced}</span>}
          </li>
        ))}
      </ul>
      {members.length > 60 && (
        <button type="button" className="btn self-start text-[12px]" onClick={() => setAll((v) => !v)}>
          {all ? t("showLess") : t("allMembers", cnt(members.length, locale))}
        </button>
      )}
    </div>
  );
}

/**
 * What the sarf books say about this pattern (P3.3): each passage verbatim with its book and page, how it
 * was matched to the pattern, and al-Raḍī's commentary on it. Extracted, not yet reviewed — said so (L3).
 */
function Classical({ rows, sources }: { rows: ClassicalRow[]; sources: ClassicalSource[] }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const src = new Map(sources.map((s) => [s.id, s]));
  const cite = (id: string, vol: number | null, page: number | null) => {
    const s = src.get(id);
    if (!s) return id;
    const name = locale === "ar" ? `${s.author_ar.split("،")[0]}، ${s.title_ar}` : `${s.author_en.split(",")[0]}, ${s.title_en}`;
    const at = page != null ? (vol && vol > 1 ? `${formatNumber(vol, locale)}/${formatNumber(page, locale)}` : formatNumber(page, locale)) : null;
    return at ? t("classicalAt", { work: name, page: at }) + (s.page_numbering === "unverified" ? ` ${t("pageUnverified")}` : "") : name;
  };
  return (
    <section className="classical" aria-label={t("classicalTitle")}>
      <p className="label-caps">{t("classicalTitle")}</p>
      <ol className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="classical-row">
            {r.heading_ar && <p className="text-[11px] text-t3" lang="ar" dir="rtl">{r.heading_ar}</p>}
            <p className="ar-classical text-[17px] leading-[1.9] text-t1" lang="ar" dir="rtl">{r.text_ar}</p>
            <p className="text-[11px] text-t3">
              {cite(r.source_id, r.page_vol, r.page)}
              {r.via !== "direct" && ` • ${t(r.via === "inflected" ? "classicalViaBase" : "classicalViaSuffix")}`}
              {r.match_confidence === "medium" && ` • ${t("classicalMatchedByExamples")}`}
            </p>
            {r.commentary.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[12px] text-t2">{t("classicalCommentary", { ...cnt(r.commentary.length, locale), work: src.get(r.commentary[0].source_id)?.[locale === "ar" ? "title_ar" : "title_en"] ?? "" })}</summary>
                {r.commentary.map((c) => (
                  <div key={c.id} className="mt-1 border-s-2 border-line ps-2">
                    <p className="ar-classical text-[15.5px] leading-[1.9] text-t2" lang="ar" dir="rtl">{c.text_ar}</p>
                    <p className="text-[11px] text-t3">{cite(c.source_id, c.page_vol, c.page)}</p>
                  </div>
                ))}
              </details>
            )}
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-t3">{t("classicalStatus")}</p>
      <ul className="flex flex-col gap-0.5">
        {sources.map((s) => (
          <CreditLine key={s.id} s={s} />
        ))}
      </ul>
    </section>
  );
}
