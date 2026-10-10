"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { RELS, type Defined, type Link as WordLink, type Rel } from "@/lib/editorial";
import { cnt, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { DirectBar, useDirect } from "./Direct";

type Found = { slug: string; ar: string; occurrences: number; root: string | null; root_spaced: string | null };
type Pick = { slug: string; ar: string; occurrences?: number; root_key?: string | null };
type Classical = { id: string; type: "furuq_contrast" | "near_synonym_candidate"; source_title_ar: string | null; headword_ar: string; target_ar: string | null; locator: string; text_ar: string | null; other_root: string | null; other_words: Pick[] };
type Field = { field_id: string; field_ar: string; source_title_ar: string | null; words: Pick[] };

/**
 * A word's near, related and opposite words (P14.4, D31): the links as the administration writes them — each a word of
 * the Quran found by search, its kind of link and a note on the difference — the links other words carry to this one
 * (a link shows on both words), and the classical books' furūq and fields as candidates to pick from, never a link by
 * themselves.
 */
export function RelationsTool({ slug, role, onBack, back }: { slug: string; role: string; onBack: () => void; back?: string }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const work = useDirect("word_relations", slug, () => ({ links: [] }));
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");
  const found = useQuery({
    queryKey: ["rel-search", asked],
    enabled: asked.length > 0,
    queryFn: async () => (await getJSON<{ results: { lemmas: Found[] } }>(`/search?q=${encodeURIComponent(asked)}&limit=8`)).results.lemmas,
  });
  const [names, setNames] = useState<Record<string, Pick>>({});
  const page = work.page;
  if (work.q.isPending) return <span className="block h-64 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!page) return <p role="alert" className="text-[13px] text-t2">{t("loadFailed")}</p>;
  const tg = page.target;
  const links = (work.value?.links ?? []) as WordLink[];
  const cand = page.candidates as { classical: Classical[]; fields: Field[]; linked: Defined };
  const known: Record<string, Pick> = { ...Object.fromEntries(RELS.flatMap((r) => cand.linked[r].map((l) => [l.slug, { slug: l.slug, ar: l.word.ar, occurrences: l.word.occurrences, root_key: l.word.root_key }]))), ...names };
  const add = (w: Pick, rel: Rel) => {
    if (w.slug === slug) return;
    setNames((x) => ({ ...x, [w.slug]: w }));
    if (links.some((l) => l.to === w.slug && l.rel === rel)) return;
    work.setValue({ links: [...links, { to: w.slug, rel, note_ar: "", note_en: "" }] });
  };
  const put = (i: number, l: Partial<WordLink>) => work.setValue({ links: links.map((x, j) => (j === i ? { ...x, ...l } : x)) });
  const there = RELS.flatMap((r) => cand.linked[r].filter((l) => l.defined_on === "there"));
  const relButtons = (w: Pick) => (
    <span className="flex flex-wrap gap-1">
      {RELS.map((r) => (
        <button key={r} type="button" className="chip text-[11.5px]" onClick={() => add(w, r)}>
          {t(`rel_${r}`)}
        </button>
      ))}
    </span>
  );

  return (
    <article className="flex flex-col gap-4" aria-labelledby="rel-h">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn self-start text-[12.5px]" onClick={onBack}>{t("back")}</button>
        {back && (
          <Link href={back} className="btn self-start text-[12.5px]">
            {t("backToReader")}
          </Link>
        )}
      </div>
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 id="rel-h" className="ar-classical text-[30px] leading-[1.3] text-t1" lang="ar">{tg.label}</h2>
        {tg.root_spaced && <span className="text-[12.5px] text-t3">{t("ctxWordRoot", { root: tg.root_spaced })}</span>}
        <span className="text-[12.5px] text-t3">{t("occurrences", { n: formatNumber(tg.occurrences, locale) })}</span>
      </header>
      <p className="text-[12.5px] leading-relaxed text-t3">{t("kindLead_word_relations")}</p>

      <div className="workbench-split">
        <section className="workbench-box" aria-labelledby="links-h">
          <h3 id="links-h" className="text-[14px] font-semibold">{t("relLinks")}</h3>
          {links.length === 0 && <p className="text-[12.5px] text-t3">{t("relNone")}</p>}
          <ul className="flex flex-col gap-2">
            {links.map((l, i) => (
              <li key={`${l.to}-${l.rel}`} className="flex flex-col gap-1.5 rounded-lg border border-line p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ar-classical text-[19px] text-t1" lang="ar">{known[l.to]?.ar ?? l.to}</span>
                  <div className="seg-group" role="group" aria-label={t("relKind")}>
                    {RELS.map((r) => (
                      <button key={r} type="button" className={"seg" + (l.rel === r ? " is-on" : "")} aria-pressed={l.rel === r} onClick={() => put(i, { rel: r })}>
                        {t(`rel_${r}`)}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="field-remove" onClick={() => work.setValue({ links: links.filter((_, j) => j !== i) })} aria-label={t("remove")}>×</button>
                </div>
                <input className="field-input text-[13px]" value={l.note_ar} placeholder={t("relNote")} aria-label={t("relNote")} onChange={(e) => put(i, { note_ar: e.target.value })} dir="rtl" lang="ar" maxLength={1000} />
              </li>
            ))}
          </ul>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setAsked(query.trim());
            }}
          >
            <input className="field-input flex-1" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("relSearch")} aria-label={t("relSearch")} dir="auto" />
            <button type="submit" className="btn">{t("relFind")}</button>
          </form>
          {found.data && (
            <ul className="flex flex-col gap-1" aria-live="polite">
              {found.data.length === 0 && <li className="text-[12.5px] text-t3">{t("relFoundNone")}</li>}
              {found.data
                .filter((w) => w.slug !== slug)
                .map((w) => (
                  <li key={w.slug} className="flex flex-wrap items-center gap-2">
                    <span className="ar-classical text-[18px] text-t1" lang="ar">{w.ar}</span>
                    <span className="text-[11.5px] text-t3">{[w.root_spaced, t("occurrences", { n: formatNumber(w.occurrences, locale) })].filter(Boolean).join(" • ")}</span>
                    {relButtons({ slug: w.slug, ar: w.ar, occurrences: w.occurrences, root_key: w.root })}
                  </li>
                ))}
            </ul>
          )}
          {there.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-line pt-2">
              <p className="text-[12px] text-t3">{t("relThere")}</p>
              <ul className="flex flex-wrap gap-2">
                {there.map((l) => (
                  <li key={`${l.slug}-${l.rel}`} className="chip text-[12px]">
                    <span lang="ar">{l.word.ar}</span> • {t(`rel_${l.rel}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="workbench-box" aria-labelledby="relcand-h">
          <h3 id="relcand-h" className="text-[14px] font-semibold">{t("candidates")}</h3>
          <p className="text-[11.5px] leading-relaxed text-t3">{t("relCandidatesLead")}</p>
          {cand.classical.length === 0 && cand.fields.length === 0 && <p className="text-[12.5px] text-t2">{t("relCandidatesNone")}</p>}
          <ul className="flex flex-col gap-2">
            {cand.classical.map((c) => (
              <li key={c.id} className="flex min-w-0 flex-col gap-1 rounded-lg border border-line p-2">
                <span className="text-[11.5px] text-t3 [overflow-wrap:anywhere]">{t(`relType_${c.type}`)} • {c.source_title_ar} • <bdi dir="ltr">{c.locator}</bdi></span>
                <span className="text-[14px] text-t1" lang="ar" dir="rtl">{[c.headword_ar, c.target_ar].filter(Boolean).join(" ⟷ ")}</span>
                {c.text_ar && <span className="line-clamp-3 text-[12.5px] leading-relaxed text-t2" lang="ar" dir="rtl">{c.text_ar}</span>}
                {c.other_words.length > 0 && (
                  <span className="flex flex-col gap-1">
                    {c.other_words.map((w) => (
                      <span key={w.slug} className="flex flex-wrap items-center gap-2">
                        <span className="ar-classical text-[16px]" lang="ar">{w.ar}</span>
                        {relButtons(w)}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
            {cand.fields.map((f) => (
              <li key={f.field_id} className="flex flex-col gap-1 rounded-lg border border-line p-2">
                <span className="text-[11.5px] text-t3">{t("relField")} • {f.source_title_ar}</span>
                <span className="text-[13.5px] text-t1" lang="ar" dir="rtl">{f.field_ar}</span>
                <span className="flex flex-col gap-1">
                  {f.words.map((w) => (
                    <span key={w.slug} className="flex flex-wrap items-center gap-2">
                      <span className="ar-classical text-[16px]" lang="ar">{w.ar}</span>
                      {relButtons(w)}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11.5px] text-t3">{t("relCandidatesCount", cnt(cand.classical.length + cand.fields.length, locale))}</p>
        </section>
      </div>
      <DirectBar kind="word_relations" target={slug} work={work} role={role} />
    </article>
  );
}
