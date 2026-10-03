"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { Term } from "@/components/terms/Term";
import { cnt, cnt2, formatNumber } from "@/lib/format";
import { SECTIONS, type SectionId, usePersonal, usePrefs, useReader } from "@/lib/reader/store";
import { Segmented } from "@/components/ui/Segmented";
import { useStar } from "@/lib/store/saved";
import type { WordPayload } from "@/lib/reader/types";
import { FORM_TERM, TAG_TERM } from "@/lib/terms";
import type { ChapterInfo } from "./ReaderShell";
import { Trail } from "./Trail";
import { TrailMap } from "./TrailMap";
import { MeaningsSection } from "./sections/Meanings";
import { FamilySection } from "./sections/Family";
import { ShapesSection } from "./sections/Shapes";
import { DictionariesSection } from "./sections/Dictionaries";
import { CenturiesSection } from "./sections/Centuries";
import { InQuranSection } from "./sections/InQuran";
import { WhereNext } from "./sections/WhereNext";
import { ListenOccurrence, WordAudioNote } from "./Listen";
import { WordSigns } from "./MushafSigns";

/** One spec order for both layouts (P2.0 resolution of RDR-207). */
export const SECTION_ORDER: SectionId[] = SECTIONS;

export function WordEntry({
  query,
  chapter,
  bodyRef,
}: {
  query: UseQueryResult<WordPayload>;
  chapter: ChapterInfo;
  bodyRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("rd");
  const scrollTo = useReader((s) => s.scrollTo);
  const jumpTo = useReader((s) => s.jumpTo);
  const trailMap = useReader((s) => s.trailMap);

  // Links into a section open it and scroll to it, in layers and tabs alike (RDR-209, RDR-527).
  // Sections above the target may still be loading (the wujūh, the dictionaries) and push it down, so
  // for a moment the target is held in place as the body grows — until the reader scrolls themselves.
  const hold = useRef<() => void>(() => {});

  // each word looked up is the new reading context and goes into today's session (RDR-113, 437, 441)
  const looked = query.data;
  useEffect(() => {
    if (!looked) return;
    usePersonal.getState().recordLookup({ word: looked.slug, wordAr: looked.ar.full, root: looked.root?.key ?? null, verse: looked.occurrence?.verse_key ?? null });
  }, [looked?.slug, looked?.occurrence?.location]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!scrollTo) return;
    const body = bodyRef.current;
    const id = setTimeout(() => {
      hold.current();
      const target = () => body?.querySelector<HTMLElement>(`[data-section="${scrollTo}"]`);
      target()?.scrollIntoView({ block: "start", behavior: "smooth" });
      jumpTo(null);
      const inner = body?.firstElementChild;
      if (!body || !inner) return;
      const ro = new ResizeObserver(() => target()?.scrollIntoView({ block: "start" }));
      ro.observe(inner);
      const release = () => {
        ro.disconnect();
        clearTimeout(stop);
        body.removeEventListener("wheel", release);
        body.removeEventListener("touchstart", release);
        hold.current = () => {};
      };
      const stop = setTimeout(release, 1500);
      body.addEventListener("wheel", release, { passive: true });
      body.addEventListener("touchstart", release, { passive: true });
      hold.current = release;
    }, 80);
    return () => clearTimeout(id);
  }, [scrollTo, bodyRef, jumpTo]);
  useEffect(() => () => hold.current(), []);

  if (query.isError) return <p className="p-4 text-[13px] text-bad">{t("loadFailed")}</p>;
  const w = query.data;
  if (!w) return <EntrySkeleton />;
  return (
    <article className="flex flex-col gap-3 p-3.5" aria-label={t("entryTitle", { tr: w.ar.translit })}>
      <Trail chapter={chapter.number} />
      {trailMap && <TrailMap chapter={chapter.number} />}
      <EntryHeader w={w} />
      <Sections w={w} chapter={chapter} />
    </article>
  );
}

function EntrySkeleton() {
  const t = useTranslations("rd");
  return (
    <div className="flex flex-col gap-3 p-4" role="status" aria-label={t("loading")}>
      <div className="h-12 w-40 animate-pulse rounded-lg bg-card-2" />
      <div className="h-4 w-56 animate-pulse rounded bg-card-2" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-card-2" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-card-2" />
    </div>
  );
}

function EntryHeader({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [star, toggleStar] = useStar(w.slug, w.ar.full);
  const setCite = useReader((s) => s.setCite);
  const setHandoff = useReader((s) => s.setHandoff);
  const jumpTo = useReader((s) => s.jumpTo);
  const occ = w.occurrence;
  const posTerm = TAG_TERM[w.pos.tag];
  const formTerm = w.verb_form ? FORM_TERM[w.verb_form] : null;
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <h2 className="ar-classical text-[40px] leading-[1.45] text-t1" lang="ar" dir="rtl">
          {w.ar.full}
        </h2>
        <span className="flex-1" />
        {occ && <ListenOccurrence verseKey={occ.verse_key} audio={occ.audio} />}
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-t2">
        <span className="mono" dir="ltr" lang="en">{w.ar.translit}</span>
        <span className="type-chip" style={{ ["--chip" as string]: "var(--c-word)" }}>
          {posTerm ? <Term id={posTerm}>{locale === "ar" ? w.pos.ar : w.pos.en}</Term> : locale === "ar" ? w.pos.ar : w.pos.en}
        </span>
        {w.pattern && (
          <button type="button" className="type-chip" style={{ ["--chip" as string]: "var(--c-form)" }} onClick={() => jumpTo("patterns")} title={t("showShapes")}>
            <span className="ar-classical text-[14px]" lang="ar">{w.pattern.ar.full}</span>
          </button>
        )}
        {formTerm && (
          <span className="type-chip" style={{ ["--chip" as string]: "var(--c-form)" }}>
            <Term id={formTerm}>{t("formN", { n: formatNumber(w.verb_form!, locale) })}</Term>
          </span>
        )}
        <span className="type-chip" style={{ ["--chip" as string]: "var(--c-desc)" }}>
          {t("inQuranCount", cnt(w.corpus_freq, locale))}
        </span>
      </p>
      {occ && (
        <div className="rounded-[10px] border border-line bg-card-2 px-3 py-2">
          <p className="text-[12px] text-t3">
            {t("thisOccurrence", { ref: occ.verse_key, surah: occ.surah.name_ar })}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5" dir="rtl">
            {occ.segments.map((s) => (
              <span key={s.index} className={"seg-chip" + (s.kind === "stem" ? " is-stem" : "")} title={s.kind === "stem" ? (locale === "ar" ? s.features?.pos?.ar : s.features?.pos?.en) : locale === "ar" ? s.label?.ar : s.label?.en}>
                <span className="quran text-[21px] leading-[1.7]" lang="ar">{s.text}</span>
                <span className="text-[10.5px] text-t3">
                  <Term id={s.kind === "prefix" ? "prefix" : s.kind === "suffix" ? "suffix" : "stem"}>
                    {s.kind === "stem" ? (locale === "ar" ? s.features?.pos?.ar : s.features?.pos?.en) ?? t("stem") : (locale === "ar" ? s.label?.ar : s.label?.en) ?? t(s.kind)}
                  </Term>
                </span>
              </span>
            ))}
          </div>
          {occ.gloss_en && (
            <p className="mt-1 text-[12.5px] italic text-t2" lang="en" dir="ltr">
              {occ.gloss_en} <span className="not-italic text-t3">— {t.rich("corpusGlossCredit", { term: (c) => <Term id="corpus">{c}</Term> })}</span>
            </p>
          )}
          <WordAudioNote audio={occ.audio} />
          <WordSigns ids={occ.signs ?? []} />
        </div>
      )}
      {w.root ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="root-chip" onClick={() => jumpTo("family")} title={t("openRootFamily", { root: w.root.ar_spaced })}>
            <span className="ar-classical text-[17px] tracking-[.06em]" lang="ar">{w.root.ar_spaced}</span>
            <span className="mono text-[11px] text-t2" dir="ltr">{w.root.translit}</span>
          </button>
          <span className="text-[12px] text-t3">
            <Term id="root">{t("root")}</Term> · {t("rootCounts", { ...cnt(w.root.occurrences, locale), ...cnt2(w.root.lemma_count, locale) })}
          </span>
        </div>
      ) : (
        <p className="text-[13px] text-t2">
          <Term id="noRoot">{t("noRoot")}</Term> — {t("noRootExplain")}
        </p>
      )}
      <WordStateControl slug={w.slug} />
      <div className="entry-actions flex flex-wrap gap-2">
        <button type="button" className="btn flex-1" onClick={() => setHandoff({ seed: "word", slug: w.slug, at: occ?.location ?? null })} title={t("openInGraphTitle")}>
          <Icon name="graph" size={13} />
          {t("openInGraph")}
        </button>
        <button type="button" className="btn" onClick={() => setCite({ kind: "word", slug: w.slug, label: occ?.surface.full ?? w.ar.full, at: occ?.location ?? null })} title={t("citeTitle")}>
          <Icon name="quote" size={13} />
          {t("cite")}
        </button>
        <button type="button" className="btn icon-btn" aria-pressed={star} onClick={toggleStar} aria-label={star ? t("unstar") : t("star")} title={star ? t("unstar") : t("star")}>
          <Icon name="star" size={14} className={star ? "text-root [&_path]:fill-current" : ""} />
        </button>
      </div>
    </header>
  );
}

/** In study mode only (D20): the reader marks a word new, learning or known — never by a tap (RDR-552). */
export function WordStateControl({ slug }: { slug: string }) {
  const t = useTranslations("rd");
  const on = usePrefs((s) => s.wordStates);
  const state = usePersonal((s) => s.wordStates[slug] ?? "new");
  const setWordState = usePersonal((s) => s.setWordState);
  if (!on) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-t3">{t("wordState")}</span>
      <Segmented
        label={t("wordState")}
        value={state}
        onChange={(v) => setWordState(slug, v)}
        options={[
          { value: "new", label: t("stateNew") },
          { value: "learning", label: t("stateLearning") },
          { value: "known", label: t("stateKnown") },
        ]}
      />
    </div>
  );
}

const SECTION_LABEL: Record<SectionId, string> = {
  senses: "secMeanings",
  family: "secFamily",
  patterns: "secShapes",
  lexica: "secDictionaries",
  timeline: "secCenturies",
  usage: "secInQuran",
};

function Sections({ w, chapter }: { w: WordPayload; chapter: ChapterInfo }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const tabs = usePrefs((s) => s.panelTabs);
  const layerOpen = usePrefs((s) => s.layerOpen);
  const toggle = usePrefs((s) => s.toggleLayer);
  const dictOff = usePrefs((s) => s.dictOff);
  const tab = useReader((s) => s.scrollTo);
  const shownDicts = w.dict_articles.filter((d) => !dictOff[d.id]).length;
  const meta: Record<SectionId, string> = {
    senses: w.senses.length ? t("nSenses", cnt(w.senses.length, locale)) : t("sourcedLines"),
    family: t("familyMeta", { ...cnt(w.family.reduce((a, g) => a + g.members.length, 0), locale), ...cnt2(w.family.filter((g) => g.pattern).length, locale) }),
    patterns: t("shapesMeta", cnt(w.shapes.root_patterns.length, locale)),
    lexica: t("dictsMeta", cnt(shownDicts, locale)),
    timeline: t("timelineMeta"),
    usage: t("usageMeta", cnt(w.attestations.total, locale)),
  };
  const bodies: Record<SectionId, React.ReactNode> = {
    senses: <MeaningsSection w={w} />,
    family: <FamilySection w={w} />,
    patterns: <ShapesSection w={w} chapter={chapter.number} />,
    lexica: <DictionariesSection w={w} />,
    timeline: <CenturiesSection w={w} />,
    usage: <InQuranSection w={w} chapter={chapter} />,
  };
  // the count on each tab (RDR-201): senses (or sourced lines until senses are assembled), words on the root,
  // patterns, dictionaries shown, sources across the centuries, places in the Quran
  const sourced =
    (w.occurrence?.meanings_here.length ?? 0) + (w.occurrence?.glosses.length ?? 0) + (w.core_meaning ? 1 : 0) + (w.mufradat?.subentries.length ?? 0) + w.particles.length;
  const counts: Record<SectionId, number> = {
    senses: w.senses.length || sourced,
    family: w.family.reduce((a, g) => a + g.members.length, 0),
    patterns: w.shapes.root_patterns.length,
    lexica: shownDicts,
    timeline: w.timeline.dictionaries.filter((d) => d.has_article && !dictOff[d.id]).length + w.timeline.corpora.filter((c) => c.attests).length,
    usage: w.attestations.total,
  };
  if (tabs) return <Tabs w={w} meta={meta} counts={counts} bodies={bodies} initial={tab} />;
  return (
    <div className="flex flex-col gap-2">
      {SECTION_ORDER.map((id) => (
        <section key={id} className="layer" data-section={id}>
          <button type="button" className="layer-head" aria-expanded={layerOpen[id]} onClick={() => toggle(id)}>
            <span className="text-[13.5px] font-medium text-t1">{t(SECTION_LABEL[id])}</span>
            <span className="text-[11.5px] text-t3">{meta[id]}</span>
            <span className="flex-1" />
            <span className="layer-chev" aria-hidden="true">▾</span>
          </button>
          {layerOpen[id] && <div className="layer-body">{bodies[id]}</div>}
        </section>
      ))}
      <WhereNext w={w} />
    </div>
  );
}

function Tabs({
  w,
  meta,
  counts,
  bodies,
  initial,
}: {
  w: WordPayload;
  meta: Record<SectionId, string>;
  counts: Record<SectionId, number>;
  bodies: Record<SectionId, React.ReactNode>;
  initial: SectionId | null;
}) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const layerOpen = usePrefs((s) => s.layerOpen);
  const firstOpen = SECTION_ORDER.find((s) => layerOpen[s]) ?? "senses";
  const active = initial ?? firstOpen;
  const set = usePrefs((s) => s.set);
  function select(id: SectionId) {
    set({ layerOpen: { senses: false, family: false, patterns: false, lexica: false, timeline: false, usage: false, [id]: true } });
  }
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={t("sections")} className="tab-strip">
        {SECTION_ORDER.map((id, i) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={active === id}
            aria-controls={`tabpanel-${id}`}
            tabIndex={active === id ? 0 : -1}
            className="tab"
            onClick={() => select(id)}
            onKeyDown={(e) => {
              const rtl = document.documentElement.dir === "rtl";
              const next = e.key === (rtl ? "ArrowLeft" : "ArrowRight") ? 1 : e.key === (rtl ? "ArrowRight" : "ArrowLeft") ? -1 : 0;
              if (!next) return;
              e.preventDefault();
              const to = SECTION_ORDER[(i + next + SECTION_ORDER.length) % SECTION_ORDER.length];
              select(to);
              document.getElementById(`tab-${to}`)?.focus();
            }}
          >
            {t(SECTION_LABEL[id])}
            <span className="tab-count mono">{formatNumber(counts[id], locale)}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`tabpanel-${active}`} aria-labelledby={`tab-${active}`} data-section={active}>
        <p className="mb-2 text-[11.5px] text-t3">{meta[active]}</p>
        {bodies[active]}
      </div>
      <WhereNext w={w} />
    </div>
  );
}
