"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";
import { citeVerse, cnt, formatNumber, toArabicDigits, verseRef } from "@/lib/format";
import type { Commentary, Features, Label, OccurrencesPage, Segment, WordDetail } from "@/lib/types";
import { useCommentary, useOccurrences, useWord } from "./hooks";
import { PanelSection } from "./PanelSection";
import { useReader } from "@/lib/store/reader";
import { LexiconArticle } from "@/components/lexicon/LexiconArticle";
import { useSaved } from "@/lib/store/saved";
import { BookmarkButton } from "@/components/saved/BookmarkButton";
import { useEffect } from "react";

function lab(l: Label | undefined, locale: string): string | null {
  if (!l) return null;
  return locale === "ar" ? l.ar : l.en;
}

export type WordInitial = { word: WordDetail; commentary?: Commentary; occurrences?: OccurrencesPage };

export function WordPanel({
  location,
  onNavigate,
  onClose,
  initial,
  page = false,
}: {
  location: string;
  onNavigate?: (dir: 1 | -1) => void;
  onClose?: () => void;
  initial?: WordInitial;
  /** Rendered as a standalone page: all layers open, no sticky header. */
  page?: boolean;
}) {
  const t = useTranslations("panel");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { data: w, isLoading, isError } = useWord(location, initial?.word);
  const visit = useSaved((st) => st.visit);
  useEffect(() => {
    if (w) visit({ location: w.location, label: w.text_imlaei, root: w.root?.key ?? null });
  }, [w, visit]);

  if (isLoading) return <p className="p-5 text-t3">{t("loadingWord")}</p>;
  if (isError || !w) return <p className="p-5 text-bad">{t("error")}</p>;

  const tokens = w.verse.tokens.filter((tk) => tk.word_from <= w.position && w.position <= tk.word_to);
  const displayText = tokens.map((tk) => tk.text).join(" ");
  const rootSpaced = w.root?.spaced ?? null;

  return (
    <div className="flex flex-col">
      <header className={(page ? "" : "sticky top-0 z-10 ") + "border-b border-line bg-card px-5 pt-4 pb-3"}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[12px] text-t3">
            {t("wordOf", { n: formatNumber(w.position, locale), ref: citeVerse(w.verse.surah_name_ar, w.verse.surah, w.verse.ayah, locale) })}
          </p>
          <div className="flex gap-1">
            <BookmarkButton kind="word" keyId={w.location} label={`${w.text_imlaei} — ${w.verse.surah_name_ar}: ${w.ayah}`} />
            {onNavigate && (
              <>
                <button type="button" className="btn icon-btn" aria-label={t("prevWord")} onClick={() => onNavigate(-1)}>
                  <Icon name="chevronStart" />
                </button>
                <button type="button" className="btn icon-btn" aria-label={t("nextWord")} onClick={() => onNavigate(1)}>
                  <Icon name="chevronEnd" />
                </button>
              </>
            )}
            {onClose && (
              <button type="button" className="btn icon-btn" aria-label={t("close")} onClick={onClose}>
                <Icon name="close" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="quran text-[44px] leading-[1.6] text-t1" dir="rtl" lang="ar">
              {displayText}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-t2">
              <span className="ar-classical text-[17px]" dir="rtl" lang="ar">{w.text_imlaei}</span>
              {w.translit && <span className="italic" dir="ltr" lang="en">{w.translit}</span>}
              <span className="rounded-full bg-word-wash px-2 py-0.5 text-[11.5px] text-word">{lab(w.features.pos, locale)}</span>
            </p>
          </div>
          {rootSpaced && (
            <Link
              href={`/roots/${encodeURIComponent(w.root!.key)}`}
              className="ar-classical shrink-0 rounded-xl border border-root/40 bg-root-wash px-3 py-1 text-[22px] text-root hover:border-root"
              lang="ar"
              aria-label={`${t("openRoot")}: ${rootSpaced}`}
            >
              {rootSpaced}
            </Link>
          )}
        </div>
      </header>

      <PanelSection id="meaning" title={t("sectionMeaning")} defaultOpen forceOpen={page}>
        <MeaningSection w={w} initial={initial?.commentary} />
      </PanelSection>

      <PanelSection id="root" title={t("sectionRoot")} defaultOpen forceOpen={page}>
        {w.root ? <RootSection w={w} /> : <NoRoot w={w} />}
      </PanelSection>

      <PanelSection id="morphology" title={t("sectionMorphology")} defaultOpen={false} forceOpen={page}>
        <MorphologySection w={w} />
      </PanelSection>

      <PanelSection id="inquran" title={t("sectionInQuran")} defaultOpen={false} forceOpen={page}>
        <InQuranSection w={w} initial={initial?.occurrences} />
      </PanelSection>

      {w.variants.length > 0 && (
        <PanelSection id="variants" title={t("sectionVariants")} defaultOpen forceOpen={page}>
          <ul className="space-y-1.5 text-[13.5px]">
            {w.variants.map((v) => (
              <li key={v.source}>
                <a href={v.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {v.root_key
                    ? t("variantLine", { source: locale === "ar" ? v.source_title_ar : v.source_title_en, root: v.root_key.split("").join(" ") })
                    : t("variantNone", { source: locale === "ar" ? v.source_title_ar : v.source_title_en })}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-t3">{t("variantsNote")}</p>
        </PanelSection>
      )}

      {w.next_steps.length > 0 && (
        <PanelSection id="next" title={t("sectionNext")} defaultOpen forceOpen={page}>
          <NextSteps w={w} />
        </PanelSection>
      )}

      <footer className="px-5 py-4 text-[11.5px] text-t3">
        <a href="https://corpus.quran.com/" target="_blank" rel="noreferrer" className="hover:underline">
          {t("morphSource")}
        </a>
        {" · "}
        <Link href="/sources" className="hover:underline">
          {tc("sources")}
        </Link>
      </footer>
    </div>
  );
}

function MeaningSection({ w, initial }: { w: WordDetail; initial?: Commentary }) {
  const t = useTranslations("panel");
  const tl = useTranslations("lexicon");
  const locale = useLocale();
  const openVerse = useReader((s) => s.openVerse);
  const { data } = useCommentary(w.verse.key, ["muyassar"], initial);
  const passage = data?.data[0]?.passage;
  const core = w.root_meaning?.core;
  const mufradat = w.root_meaning?.mufradat;
  return (
    <div className="space-y-4">
      {locale === "en" && (w.gloss_en || w.lemma?.gloss_en) && (
        <p className="text-[15px] text-t1" dir="ltr" lang="en">
          <span className="text-t3">{t("glossEn")}: </span>
          <i>{w.gloss_en ?? w.lemma?.gloss_en}</i>
        </p>
      )}
      {w.glosses.map((g) => (
        <div key={g.id}>
          <p className="label-caps mb-1">{tl("glossTitle", { title: g.title_ar })}</p>
          <p className="ar-classical whitespace-pre-line text-[16.5px] leading-[2] text-t1" dir="rtl" lang="ar">
            {g.gloss}
          </p>
          <p className="text-[11.5px] text-t3">
            {`${g.title_ar} — ${g.author_ar}`}
            {g.page_ref ? ` · ${locale === "ar" ? toArabicDigits(g.page_ref) : g.page_ref}` : ""}
          </p>
        </div>
      ))}
      {core && (
        <div>
          <p className="label-caps mb-1">{tl("coreMeaning")}</p>
          <p className="ar-classical text-[18px] leading-[2] text-t1" dir="rtl" lang="ar">{core.text}</p>
          <p className="text-[11.5px] text-t3">
            {`${core.title_ar} — ${core.author_ar}`}
            {core.page_ref ? ` · ${locale === "ar" ? toArabicDigits(core.page_ref) : core.page_ref}` : ""}
          </p>
        </div>
      )}
      <div>
        <p className="label-caps mb-1">{t("meaningInContext")}</p>
        {passage ? (
          <p className="ar-classical text-[16.5px] leading-[2] text-t1" dir="rtl" lang="ar">
            {passage.text}
          </p>
        ) : (
          <p className="text-t3">…</p>
        )}
        <Link
          href={`/quran/${w.verse.surah}/${w.verse.ayah}`}
          className="btn mt-2"
          onClick={(e) => {
            // Inside the reader, open the verse panel instead of navigating away.
            if (document.querySelector(".reader-text")) {
              e.preventDefault();
              openVerse(w.verse.key, "tafsir");
            }
          }}
        >
          <Icon name="tafsir" />
          {t("readTafsir")}
        </Link>
      </div>
      {mufradat && (
        <div>
          <p className="label-caps mb-1">{`${tl("quranUsage")} — ${mufradat.title_ar}`}</p>
          <LexiconArticle
            work={{ ...mufradat, author_en: "", death_ce: null, lang: "ar", edition_note: "", source_url: "", license: "", redistributable: false }}
            entry={mufradat.entry}
            compact
          />
          <p className="mt-1 text-[11.5px] text-t3">{`${mufradat.author_ar}${mufradat.death_hijri ? ` (ت ${formatNumber(mufradat.death_hijri, locale)}هـ)` : ""}`}</p>
        </div>
      )}
      {w.root && (
        <Link href={`/roots/${encodeURIComponent(w.root.key)}#lexicon`} className="inline-block text-[13px] text-word hover:underline">
          {tl("openInRoot")}
        </Link>
      )}
    </div>
  );
}

function RootSection({ w }: { w: WordDetail }) {
  const t = useTranslations("panel");
  const tc = useTranslations("common");
  const locale = useLocale();
  const root = w.root!;
  const max = Math.max(...root.lemmas.map((l) => l.occurrences));
  return (
    <div className="space-y-3">
      <p className="text-[14px] text-t1">
        {t("rootOccurrences", { count: tc("occurrences", cnt(root.occurrences, locale)) })}
      </p>
      <p className="text-[12.5px] text-t3">
        {t("rootStats", {
          verses: tc("verses", cnt(root.verse_count, locale)),
          surahs: tc("surahs", cnt(root.surah_count, locale)),
          lemmas: tc("lemmas", cnt(root.lemma_count, locale)),
        })}
      </p>
      <div>
        <p className="label-caps mb-1.5">{t("family")}</p>
        <ul className="space-y-1">
          {root.lemmas.map((l) => {
            const current = l.id === w.lemma?.id;
            return (
              <li key={l.id}>
                <Link
                  href={`/roots/${encodeURIComponent(root.key)}#lemma-${l.id}`}
                  className={
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-1 hover:bg-card-2 " +
                    (current ? "bg-word-wash" : "")
                  }
                  aria-current={current ? "true" : undefined}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="ar-classical truncate text-[19px]" dir="rtl" lang="ar">{l.ar}</span>
                    <span className="text-[11.5px] text-t3">{posLabel(l.pos, locale)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-card-3 sm:block" aria-hidden="true">
                      <span className="block h-full rounded-full bg-root" style={{ width: `${Math.max(6, (l.occurrences / max) * 100)}%` }} />
                    </span>
                    <span className="mono w-10 text-end text-[12px] text-t2">{formatNumber(l.occurrences, locale)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/roots/${encodeURIComponent(root.key)}`} className="btn">
          <Icon name="root" />
          {t("openRoot")}
        </Link>
        <Link href={`/graph/root/${encodeURIComponent(root.key)}`} className="btn">
          <Icon name="graph" />
          {t("openGraph")}
        </Link>
      </div>
    </div>
  );
}

const POS_AR: Record<string, string> = { N: "اسم", PN: "علم", ADJ: "صفة", V: "فعل", IMPN: "اسم فعل", PRON: "ضمير", DEM: "اسم إشارة", REL: "اسم موصول", T: "ظرف زمان", LOC: "ظرف مكان" };
const POS_EN: Record<string, string> = { N: "noun", PN: "proper noun", ADJ: "adjective", V: "verb", IMPN: "verbal noun", PRON: "pronoun", DEM: "demonstrative", REL: "relative", T: "time adverb", LOC: "place adverb" };

function posLabel(pos: string, locale: string): string {
  return (locale === "ar" ? POS_AR : POS_EN)[pos] ?? pos;
}

function NoRoot({ w }: { w: WordDetail }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  return (
    <div>
      <p className="text-[14px] font-medium text-t1">{t("noRoot")}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-t2">{t("noRootExplain", { pos: lab(w.features.pos, locale) ?? "" })}</p>
    </div>
  );
}

function featureRows(f: Features, locale: string, t: ReturnType<typeof useTranslations>): [string, string][] {
  const rows: [string, string][] = [];
  const add = (k: string, v: string | null | undefined) => v && rows.push([k, v]);
  add(locale === "ar" ? "النوع" : "Part of speech", lab(f.pos, locale));
  if (f.verb_form) add(t("verbForm"), `${f.verb_form.pattern} (${f.verb_form.roman})`);
  add(locale === "ar" ? "الزمن" : "Aspect", lab(f.aspect, locale));
  add(locale === "ar" ? "البناء" : "Voice", lab(f.voice, locale));
  add(locale === "ar" ? "الاشتقاق" : "Derivation", lab(f.derivation, locale));
  const pgn = [lab(f.person, locale), lab(f.gender, locale), lab(f.number, locale)].filter(Boolean).join(" · ");
  add(locale === "ar" ? "الشخص والعدد" : "Person · gender · number", pgn || null);
  add(locale === "ar" ? "الحالة الإعرابية" : "Case", lab(f.case, locale));
  add(locale === "ar" ? "الإعراب" : "Mood", lab(f.mood, locale));
  if (f.special) add(locale === "ar" ? "المجموعة" : "Group", lab(f.special, locale));
  return rows;
}

function MorphologySection({ w }: { w: WordDetail }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  return (
    <div className="space-y-3">
      <div>
        <p className="label-caps mb-1.5">{t("segments")}</p>
        <ol className="flex flex-wrap gap-1.5" dir="rtl">
          {w.segments.map((s) => (
            <SegmentChip key={s.index} s={s} locale={locale} />
          ))}
        </ol>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13.5px]">
        {featureRows(w.features, locale, t).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-t3">{k}</dt>
            <dd className="text-t1">{v}</dd>
          </div>
        ))}
        {w.lemma && (
          <div className="contents">
            <dt className="text-t3">{t("lemma")}</dt>
            <dd className="ar-classical text-[18px]" dir="rtl" lang="ar">{w.lemma.ar}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function SegmentChip({ s, locale }: { s: Segment; locale: string }) {
  const t = useTranslations("panel");
  const color = s.kind === "stem" ? "var(--c-word)" : "var(--c-desc)";
  const label = s.kind === "stem" ? lab(s.features?.pos, locale) : lab(s.label, locale);
  return (
    <li
      className="flex flex-col items-center rounded-lg border px-2.5 py-1"
      style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 8%, var(--card))` }}
    >
      <span className="quran text-[22px] leading-[1.8]" lang="ar">{s.text}</span>
      <span className="text-[11px] text-t2">{label}</span>
      <span className="text-[10px] text-t3">{t(s.kind)}</span>
    </li>
  );
}

function InQuranSection({ w, initial }: { w: WordDetail; initial?: OccurrencesPage }) {
  const t = useTranslations("panel");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { data } = useOccurrences(w.root?.key ?? null, w.lemma?.id ?? null, 6, initial);
  return (
    <div className="space-y-3">
      <ul className="space-y-1 text-[13.5px]">
        <li>{t("formCount", { count: tc("occurrences", cnt(w.occurrences.form, locale)) })}</li>
        {w.occurrences.lemma != null && <li>{t("lemmaCountLine", { count: tc("occurrences", cnt(w.occurrences.lemma, locale)) })}</li>}
        {w.occurrences.root != null && <li>{t("rootCountLine", { count: tc("occurrences", cnt(w.occurrences.root, locale)) })}</li>}
      </ul>
      <p className="text-[12px] text-t3">
        {t("countsNote")}{" "}
        <Link href="/about#counting" className="text-word hover:underline">{t("countsHow")}</Link>
      </p>
      {data && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {data.data.map((o) => (
            <li key={o.location}>
              <Link href={`/quran/${o.verse_key.replace(":", "/")}`} className="block px-3 py-2 hover:bg-card-2">
                <span className="quran line-clamp-2 text-[18px] leading-[2]" dir="rtl" lang="ar">
                  <span className="text-t3">{tail(o.left, 5)} </span>
                  <mark className="rounded bg-root-wash px-0.5 text-root">{o.keyword}</mark>
                  <span className="text-t3"> {head(o.right, 5)}</span>
                </span>
                <span className="mono text-[11.5px] text-t3" dir="ltr">{verseRef(o.verse_key, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function tail(s: string, n: number): string {
  const p = s.split(" ").filter(Boolean);
  return (p.length > n ? "… " : "") + p.slice(-n).join(" ");
}
function head(s: string, n: number): string {
  const p = s.split(" ").filter(Boolean);
  return p.slice(0, n).join(" ") + (p.length > n ? " …" : "");
}

function NextSteps({ w }: { w: WordDetail }) {
  const t = useTranslations("panel");
  const locale = useLocale();
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {w.next_steps.map((s) => {
        const color = s.kind === "cousin" ? "var(--c-word)" : s.kind === "verse" ? "var(--c-sentence)" : "var(--c-form)";
        const [sv, av] = s.location.split(":");
        return (
          <li key={s.kind}>
            <Link
              href={`/quran/${sv}?w=${s.location}#v${av}`}
              className="block h-full rounded-xl border border-line bg-card p-3 hover:border-ring"
              style={{ borderTop: `3px solid ${color}` }}
            >
              <span className="label-caps block" style={{ color }}>
                {s.kind === "cousin" ? t("nextCousin") : s.kind === "verse" ? t("nextVerse") : t("nextShape")}
              </span>
              {s.kind === "verse" ? (
                <span className="mono mt-1 block text-[18px]" dir="ltr">{verseRef(s.verse_key, locale)}</span>
              ) : (
                <span className="ar-classical mt-1 block text-[22px]" dir="rtl" lang="ar">{s.lemma.ar}</span>
              )}
              <span className="mt-1 block text-[12px] text-t3">
                {s.kind === "cousin" ? t("nextCousinWhy") : s.kind === "verse" ? t("nextVerseWhy") : t("nextShapeWhy")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
