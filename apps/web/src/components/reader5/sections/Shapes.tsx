"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { cnt, cnt2, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { ClassicalRow, ClassicalSource, LemmaLite, PatternInfo, WordPayload } from "@/lib/reader/types";
import { CreditLine } from "../CreditLine";
import { PatternFunction, WordChip } from "./Family";

/** Shapes (design 03 §3.5.3, RDR-226…232): the root's patterns with every family word on each
 * (the prototype showed one per pattern, RDR-229), and a pattern's words across roots. */
export function ShapesSection({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const [view, setView] = useState<"root" | "pattern">("root");
  const [picked, setPicked] = useState<string | null>(w.pattern?.slug ?? null);
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label={t("secShapes")}
        value={view}
        onChange={setView}
        options={[
          { value: "root", label: t("thisRoot") },
          { value: "pattern", label: t("thisPattern") },
        ]}
      />
      {view === "root" ? (
        <table className="shapes-table">
          <tbody>
            {w.family
              .filter((g) => g.pattern)
              .map((g) => (
                <tr key={g.pattern!.slug}>
                  <td>
                    <button
                      type="button"
                      className="ar-classical text-[18px] text-form hover:underline"
                      lang="ar"
                      onClick={() => {
                        setPicked(g.pattern!.slug);
                        setView("pattern");
                      }}
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
              ))}
          </tbody>
        </table>
      ) : (
        <PatternView slug={picked} />
      )}
    </div>
  );
}

function PatternView({ slug }: { slug: string | null }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const q = useQuery({
    queryKey: ["pattern", slug],
    queryFn: () =>
      getJSON<PatternInfo & { members: (LemmaLite & { root: { key: string; ar_spaced: string } | null })[]; classical: { rows: ClassicalRow[]; sources: ClassicalSource[] } }>(
        `/patterns/${slug}`,
      ),
    enabled: !!slug,
  });
  if (!slug) return <p className="text-[13px] text-t3">{t("noPattern")}</p>;
  if (!q.data) return <div className="h-20 animate-pulse rounded-xl bg-card-2" />;
  const p = q.data;
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
      <ul className="flex flex-col divide-y divide-line">
        {p.members.slice(0, 60).map((m) => (
          <li key={m.slug} className="flex items-center gap-3 py-1.5">
            <WordChip m={m} />
            <span className="min-w-0 flex-1 truncate text-[12px] text-t2" lang="en">{m.gloss_en ?? ""}</span>
            {m.root && <span className="ar-classical text-[15px] text-root" lang="ar">{m.root.ar_spaced}</span>}
          </li>
        ))}
      </ul>
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
              {r.via !== "direct" && ` · ${t(r.via === "inflected" ? "classicalViaBase" : "classicalViaSuffix")}`}
              {r.match_confidence === "medium" && ` · ${t("classicalMatchedByExamples")}`}
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
