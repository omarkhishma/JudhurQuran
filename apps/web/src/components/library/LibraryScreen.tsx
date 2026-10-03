"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { cnt, formatNumber } from "@/lib/format";
import { listTexts, type UserTextMeta } from "@/lib/library/texts";
import { getJSON } from "@/lib/reader/api";
import { usePersonal } from "@/lib/reader/store";
import { AddTextSheet } from "./AddTextSheet";

export type TextCard = { slug: string; kind: string; title_ar: string; title_en: string; meta_ar: string | null; meta_en: string | null; chapter_count: number; passage_count: number; token_count: number; lemma_count: number | null };
type SurahRow = { number: number; name_ar: string; name_translit: string; verse_count: number; revelation_place: string };
type Filter = "all" | "quran" | "mine";

const pctFmt = (locale: string) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent", maximumFractionDigits: 0 });

/**
 * The Library (design 05 §5.1, inventory LIB-01…48 with the Quran notes LIB-Q01…Q08): the shelf drawn from the
 * text catalogue, the Quran with its own entry into the sūras and each sūra's progress, the place to resume
 * (sūra and verse), and the reader's own texts — private, in this browser — with an add-a-text sheet whose
 * preview reads the words against the Quran. "Known" counts unique words and never claims what it cannot
 * measure (LIB-12, LIB-Q04).
 */
export function LibraryScreen({ texts, openAdd }: { texts: TextCard[]; openAdd: boolean }) {
  const t = useTranslations("library");
  const locale = useLocale();
  const client = useIsClient();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(openAdd);
  const mine = useQuery({ queryKey: ["user-texts"], queryFn: listTexts, enabled: client });
  const surahs = useQuery({ queryKey: ["surahs"], queryFn: () => getJSON<{ data: SurahRow[] }>("/surahs"), staleTime: Infinity });
  const progress = usePersonal((s) => s.progress);
  const read = usePersonal((s) => s.read);
  const wordStates = usePersonal((s) => s.wordStates);
  const sessions = usePersonal((s) => s.sessions);
  const known = useMemo(() => new Set(Object.entries(wordStates).filter(([, v]) => v === "known").map(([k]) => k)), [wordStates]);
  const seen = useMemo(() => new Set(sessions.flatMap((s) => s.words)), [sessions]);
  const quran = texts.find((x) => x.kind === "quran");
  const userTexts = mine.data ?? [];
  const pct = pctFmt(locale);

  // ?add=1 opens the sheet (LIB-37); closing it takes the parameter away
  useEffect(() => {
    if (adding) return;
    const u = new URL(window.location.href);
    if (u.searchParams.has("add")) {
      u.searchParams.delete("add");
      window.history.replaceState(window.history.state, "", u);
    }
  }, [adding]);

  const versesRead = client ? Object.entries(read).filter(([k]) => k.startsWith("quran:")).reduce((n, [, a]) => n + a, 0) : 0;
  const resume = client ? progress.quran : undefined;
  const resumeSurah = resume ? surahs.data?.data.find((s) => s.number === resume.chapter) : undefined;
  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: t("filterAll") },
    ...(quran ? [{ value: "quran" as const, label: t("filterQuran") }] : []),
    ...(userTexts.length ? [{ value: "mine" as const, label: t("filterMine", { n: formatNumber(userTexts.length, locale) }) }] : []),
  ];
  const shown = (filter === "all" || filter === "quran" ? [quran].filter(Boolean).length : 0) + (filter === "all" || filter === "mine" ? userTexts.length : 0);

  return (
    <div className="library-screen">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold">{t("title")}</h1>
        <span className="flex-1" />
        {filters.length > 1 && <Segmented label={t("filterLabel")} value={filter} onChange={setFilter} options={filters} />}
      </div>

      {resume && resumeSurah && (
        <section className="flex flex-col gap-2" aria-label={t("continue")}>
          <p className="label-caps">{t("continue")}</p>
          <Link href={`/quran/${resume.chapter}${resume.passage > 1 ? `#v${resume.passage}` : ""}`} className="continue-card">
            <span className="book-cover is-quran" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="ar-classical text-[20px]" lang="ar">{`سورة ${resumeSurah.name_ar}`}</span>
              <span className="text-[12px] text-t3">
                {t("continueMeta", { ayah: formatNumber(resume.passage, locale), of: formatNumber(resumeSurah.verse_count, locale), date: new Date(resume.at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long" }) })}
              </span>
              <span className="progress-line" aria-hidden="true">
                <span style={{ width: `${(resume.passage / resumeSurah.verse_count) * 100}%` }} />
              </span>
            </span>
            <span className="btn btn-primary">{t("resume")}</span>
          </Link>
        </section>
      )}

      <section className="flex flex-col gap-2" aria-label={t("shelf")}>
        <div className="flex items-baseline gap-2">
          <p className="label-caps">{t("shelf")}</p>
          <span className="flex-1" />
          <span className="text-[12px] text-t3">{t("shelfMeta", { texts: formatNumber(shown, locale), known: formatNumber(known.size, locale) })}</span>
        </div>
        <ul className="shelf">
          {quran && filter !== "mine" && (
            <li>
              <Link href="/read" className="book-card">
                <span className="book-cover is-quran" aria-hidden="true" />
                <span className="book-kind">{t("kindQuran")}</span>
                <span className="ar-classical text-[19px]" lang="ar" dir="rtl">{quran.title_ar}</span>
                {locale !== "ar" && <span className="text-[12.5px] text-t2">{quran.title_en}</span>}
                <span className="text-[12px] text-t3">{t("quranMeta", { surahs: formatNumber(quran.chapter_count, locale), verses: formatNumber(quran.passage_count, locale) })}</span>
                <KnownLine known={quran.lemma_count ? [...known].length : 0} total={quran.lemma_count ?? 0} seen={seen.size} />
                <ProgressLine value={versesRead / quran.passage_count} label={versesRead ? pct.format(versesRead / quran.passage_count) : t("notStarted")} />
              </Link>
            </li>
          )}
          {filter !== "quran" &&
            userTexts.map((x) => (
              <li key={x.id}>
                <UserTextCard x={x} known={known} />
              </li>
            ))}
          {filter !== "quran" && (
            <li>
              <button type="button" className="add-tile" onClick={() => setAdding(true)}>
                <span className="text-[26px] leading-none" aria-hidden="true">+</span>
                <span className="text-[14px] font-medium">{t("addText")}</span>
                <span className="text-[12px] text-t3">{t("addTextModes")}</span>
              </button>
            </li>
          )}
        </ul>
        {client && filter === "mine" && userTexts.length === 0 && <p className="text-[13px] text-t3">{t("mineEmpty")}</p>}
      </section>

      {quran && filter !== "mine" && surahs.data && (
        <section className="flex flex-col gap-2" aria-label={t("surahs")}>
          <div className="flex items-baseline gap-2">
            <p className="label-caps">{t("surahs")}</p>
            <span className="flex-1" />
            <span className="text-[12px] text-t3">{t("surahsNote")}</span>
          </div>
          <ol className="surah-grid">
            {surahs.data.data.map((s) => {
              const r = client ? (read[`quran:${s.number}`] ?? 0) : 0;
              return (
                <li key={s.number}>
                  <Link href={`/quran/${s.number}`} className="surah-cell" aria-label={t("surahCell", { name: s.name_ar, read: formatNumber(r, locale), of: formatNumber(s.verse_count, locale) })}>
                    <span className="mono text-[11px] text-t3">{formatNumber(s.number, locale)}</span>
                    <span className="ar-classical min-w-0 flex-1 truncate text-[16px]" lang="ar">{s.name_ar}</span>
                    <span className="text-[10.5px] text-t3">{s.revelation_place === "meccan" ? t("meccan") : t("medinan")}</span>
                    <span className="progress-line is-thin" aria-hidden="true">
                      <span style={{ width: `${(r / s.verse_count) * 100}%` }} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {adding && (
        <AddTextSheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setFilter("mine");
            void qc.invalidateQueries({ queryKey: ["user-texts"] });
          }}
        />
      )}
    </div>
  );
}

function KnownLine({ known, total, seen }: { known: number; total: number; seen: number }) {
  const t = useTranslations("library");
  const locale = useLocale();
  // nothing measured is not "100% known" (LIB-12): say what there is
  if (!total) return null;
  return (
    <span className="text-[12px] text-t2">
      {known ? t("knownOf", { known: formatNumber(known, locale), total: formatNumber(total, locale) }) : t("noneKnown")}
      {seen > 0 && <span className="text-t3"> · {t("seenWords", cnt(seen, locale))}</span>}
    </span>
  );
}

function ProgressLine({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="progress-line flex-1" aria-hidden="true">
        <span style={{ width: `${Math.min(1, value) * 100}%` }} />
      </span>
      <span className="text-[11.5px] text-t3">{label}</span>
    </span>
  );
}

function UserTextCard({ x, known }: { x: UserTextMeta; known: Set<string> }) {
  const t = useTranslations("library");
  const locale = useLocale();
  const k = x.lemmas.filter((s) => known.has(s)).length;
  return (
    <Link href={`/library/text/${x.id}`} className="book-card">
      <span className="book-cover is-mine" aria-hidden="true">{t("yours")}</span>
      <span className="book-kind">{t("kindMine")}</span>
      <span className="ar-classical text-[19px]" lang="ar" dir="rtl">{x.title}</span>
      <span className="text-[12px] text-t3">{t("mineMeta", { words: formatNumber(x.words, locale), review: formatNumber(x.review, locale) })}</span>
      <span className="text-[12px] text-t2">
        {x.lemmas.length ? (k ? t("knownOf", { known: formatNumber(k, locale), total: formatNumber(x.lemmas.length, locale) }) : t("noneKnown")) : t("noQuranWords")}
      </span>
      <ProgressLine value={0} label={t("new")} />
    </Link>
  );
}
