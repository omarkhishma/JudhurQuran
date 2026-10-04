"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { Link, useRouter } from "@/i18n/navigation";
import { normalize } from "@/lib/arabic/normalize";
import { paragraphHref } from "@/lib/books";
import { useIsClient } from "@/lib/client";
import { cnt, formatNumber } from "@/lib/format";
import { hadithHref, refText } from "@/lib/hadith";
import { listTexts, userUri } from "@/lib/library/texts";
import { getJSON, useSurahRoots } from "@/lib/reader/api";
import { usePersonal, usePrefs, useReader } from "@/lib/reader/store";
import type { ChapterInfo } from "./ReaderShell";

type Division = { number: number; key: string; surah: number; ayah: number; page: number; name_ar: string; name_translit: string; juz?: number };
type SurahRow = { number: number; name_ar: string; name_translit: string; name_en: string; revelation_place: string; verse_count: number; juz_start: number; page_start: number };

/**
 * The rail (design 03 §3.4, adapted per RDR-541): the sūra index with juzʾ navigation in place of the
 * prototype's library + chapters, and the roots of this sūra — a tap underlines every word built on it. Its texts
 * view lists every text as the prototype's books list does (RDR-063): the hadith, the books and the reader's own.
 */
const ROOTS_FIRST = 60;

export function Rail({ chapter, overlay, onNavigate }: { chapter: ChapterInfo; overlay: boolean; onNavigate: () => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [view, setView] = useState<"surahs" | "juz" | "page" | "texts">("surahs");
  const [q, setQ] = useState("");
  const list = useRef<HTMLUListElement>(null);
  const surahs = useQuery({ queryKey: ["surahs"], queryFn: () => getJSON<{ data: SurahRow[] }>("/surahs"), staleTime: Infinity });
  const roots = useSurahRoots(chapter.number);
  const [allRoots, setAllRoots] = useState(false);
  const focusRoot = useReader((s) => s.focusRoot);
  const study = usePrefs((s) => s.wordStates);
  const states = usePersonal((s) => s.wordStates);
  // where the reader stopped, and how far each sūra has been read (RDR-071, 497)
  const read = usePersonal((s) => s.read);
  const last = usePersonal((s) => s.progress.quran);
  // Vocabulary coverage per sūra in study mode (RDR-571): the share of its words marked known.
  const sets = useQuery({ queryKey: ["lemma-sets"], queryFn: () => getJSON<{ data: Record<string, string[]> }>("/surahs/lemma-sets"), enabled: study, staleTime: Infinity });
  const pct = (n: number) => {
    const set = sets.data?.data[String(n)];
    if (!set?.length) return null;
    const known = set.filter((s) => states[s] === "known").length;
    const learning = set.filter((s) => states[s] === "learning").length;
    return { known: known / set.length, learning: learning / set.length };
  };
  const percent = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "percent", maximumFractionDigits: 0 });
  const setFocusRoot = useReader((s) => s.setFocusRoot);

  const filtered = useMemo(() => {
    const all = surahs.data?.data ?? [];
    const k = q.trim();
    if (!k) return all;
    const nk = normalize(k);
    return all.filter((s) => String(s.number) === k.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))) || normalize(s.name_ar).includes(nk) || s.name_translit.toLowerCase().includes(k.toLowerCase()) || s.name_en.toLowerCase().includes(k.toLowerCase()));
  }, [surahs.data, q]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "center" });
  }, [surahs.data]);

  const max = Math.max(1, ...(roots.data?.data ?? []).map((r) => r.here));

  return (
    <aside className={"reader-rail" + (overlay ? " is-overlay" : "")} aria-label={t("contents")}>
      <div className="flex items-center justify-between">
        <p className="label-caps">{t("contents")}</p>
        <Link href="/library" className="text-[11px] text-t3 hover:text-t1">{t("allTexts")}</Link>
      </div>
      <Segmented
        label={t("contents")}
        value={view}
        onChange={setView}
        options={[
          { value: "surahs", label: t("viewSurahs") },
          { value: "juz", label: t("viewJuz") },
          { value: "page", label: t("viewPage") },
          { value: "texts", label: t("viewTexts") },
        ]}
      />
      {view === "texts" && <TextsList onNavigate={onNavigate} />}
      {view === "juz" && <JuzList chapter={chapter} onNavigate={onNavigate} />}
      {view === "page" && <PageJump onNavigate={onNavigate} />}
      {view === "surahs" && (
      <>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("findSurah")}
        aria-label={t("findSurah")}
        className="rail-search"
        dir="auto"
      />
      {surahs.isError && <p className="px-2 text-[12px] text-bad" role="alert">{t("loadFailed")}</p>}
      <ul ref={list} className="rail-list" aria-label={t("surahIndex")}>
        {filtered.map((s) => {
          const current = s.number === chapter.number;
          return (
            <li key={s.number}>
              <Link href={`/quran/${s.number}`} className="rail-row" aria-current={current ? "page" : undefined} onClick={onNavigate}>
                <span className="mono w-[26px] text-[11px] text-t3">{formatNumber(s.number, locale)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="ar-classical truncate text-[15px] leading-[1.5]" lang="ar">{s.name_ar}</span>
                  <span className="truncate text-[10.5px] text-t3">
                    {(s.revelation_place === "meccan" ? t("meccan") : t("medinan")) + " • " + t("verses", cnt(s.verse_count, locale))}
                  </span>
                  {last?.chapter === s.number && (
                    <span className="rail-resume">
                      <span className="dot" style={{ background: "var(--c-root)" }} />
                      {t("stoppedAt", { n: formatNumber(last.passage, locale) })}
                    </span>
                  )}
                  {!!read[`quran:${s.number}`] && (
                    <span className="read-bar" title={t("readPct", { pct: percent.format(read[`quran:${s.number}`] / s.verse_count) })}>
                      <span style={{ width: `${(read[`quran:${s.number}`] / s.verse_count) * 100}%` }} />
                    </span>
                  )}
                  {study && pct(s.number) && (
                    <span className="flex items-center gap-1.5" title={t("coverage", { pct: percent.format(pct(s.number)!.known) })}>
                      <span className="coverage-bar" aria-hidden="true" style={{ ["--known" as string]: `${pct(s.number)!.known * 100}%`, ["--learning" as string]: `${(pct(s.number)!.known + pct(s.number)!.learning) * 100}%` }} />
                      <span className="text-[10.5px] text-t2">{t("coverage", { pct: percent.format(pct(s.number)!.known) })}</span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      </>
      )}
      <hr className="border-line" />
      <div className="flex items-center justify-between">
        <p className="label-caps">{t("rootsOfSurah")}</p>
        {focusRoot && (
          <button type="button" className="text-[11px] text-t3 hover:text-bad" onClick={() => setFocusRoot(null)} title={t("clearHighlightTitle")}>
            {t("clear")}
          </button>
        )}
      </div>
      {roots.isError && <p className="px-2 text-[12px] text-bad" role="alert">{t("loadFailed")}</p>}
      <ul className="long-list flex flex-col gap-0.5" aria-label={t("rootsOfSurah")}>
        {(roots.data?.data ?? []).slice(0, allRoots ? undefined : ROOTS_FIRST).map((r) => {
          const on = focusRoot === r.key;
          return (
            <li key={r.key}>
              <button
                type="button"
                className={"rail-root" + (on ? " is-on" : "")}
                aria-pressed={on}
                onClick={() => setFocusRoot(on ? null : r.key)}
                title={t("highlightRootTitle", { root: r.spaced })}
              >
                <span className="ar-classical text-[17px] tracking-[.06em] text-root" lang="ar">{r.spaced}</span>
                <span className="mono text-[10.5px] text-t3" dir="ltr" lang="en">{r.translit}</span>
                <span className="rail-bar" aria-hidden="true">
                  <span style={{ width: `${(r.here / max) * 100}%` }} />
                </span>
                <span className="mono text-[11px] text-t3">{formatNumber(r.here, locale)}×</span>
              </button>
            </li>
          );
        })}
      </ul>
      {(roots.data?.data.length ?? 0) > ROOTS_FIRST && (
        // every root of the sūra is reachable (al-Baqara uses 585); the first rows keep the page light (RDR-073)
        <button type="button" className="btn self-start text-[12px]" aria-expanded={allRoots} onClick={() => setAllRoots((v) => !v)}>
          {allRoots ? t("fewerRoots") : t("allRoots", cnt(roots.data!.data.length, locale))}
        </button>
      )}
    </aside>
  );
}

type TextRow = { slug: string; kind: string; title_ar: string; title_en: string };

/**
 * Every text (RDR-063, adapted): the Quran, which this reader reads; the hadith collections, the books and the
 * reader's own texts, each opening in its own reader with the word panel beside it (P11.3) — so choosing one leaves
 * this sūra, its selection and its drawers behind (RDR-064) — and, where the reader stopped in one, the way back.
 */
function TextsList({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const client = useIsClient();
  const texts = useQuery({ queryKey: ["texts"], queryFn: () => getJSON<{ data: TextRow[] }>("/texts"), staleTime: Infinity });
  const mine = useQuery({ queryKey: ["user-texts"], queryFn: listTexts, enabled: client });
  const progress = usePersonal((s) => s.progress);
  const name = (x: TextRow) => (locale === "ar" ? x.title_ar : x.title_en);
  type Row = { key: string; href: string; title: string; ar: boolean; back?: { href: string; label: string } };
  const all = texts.data?.data ?? [];
  const groups: { label: string; rows: Row[] }[] = [
    {
      label: t("textsHadith"),
      rows: all
        .filter((x) => x.kind === "hadith")
        .map((x) => {
          const at = progress[`hadith:${x.slug}`];
          return { key: x.slug, href: `/hadith/${x.slug}`, title: name(x), ar: locale === "ar", back: at?.ref ? { href: hadithHref(x.slug, at.ref), label: t("stoppedAtRef", { ref: refText(at.ref, locale) }) } : undefined };
        }),
    },
    {
      label: t("textsBooks"),
      rows: all
        .filter((x) => x.kind === "book")
        .map((x) => {
          const at = progress[`book:${x.slug}`];
          return { key: x.slug, href: `/books/${x.slug}`, title: name(x), ar: locale === "ar", back: at?.ref ? { href: paragraphHref(x.slug, at.ref), label: at.label ? t("stoppedAtLabel", { label: at.label }) : t("stoppedHere") } : undefined };
        }),
    },
    {
      label: t("textsMine"),
      rows: (mine.data ?? []).map((x) => {
        const at = progress[userUri(x.id)];
        // the reader's own titles are theirs, in the script they wrote them
        return { key: x.id, href: `/library/text/${x.id}`, title: x.title, ar: true, back: at && at.passage > 1 ? { href: `/library/text/${x.id}#p${at.passage}`, label: t("stoppedAtPassage", { n: formatNumber(at.passage, locale) }) } : undefined };
      }),
    },
  ];
  if (texts.isError) return <p className="px-2 text-[12px] text-bad" role="alert">{t("loadFailed")}</p>;
  if (!texts.data) return <div className="h-40 animate-pulse rounded-lg bg-card-2" />;
  return (
    <nav className="flex flex-col gap-3" aria-label={t("viewTexts")}>
      <ul className="rail-list">
        <li>
          <span className="rail-row" aria-current="page">
            <span className="ar-classical text-[15px] leading-[1.5]" lang="ar">{t("textsQuran")}</span>
          </span>
        </li>
      </ul>
      {groups.map((g) =>
        g.rows.length ? (
          <section key={g.label} className="flex flex-col gap-1" aria-label={g.label}>
            <p className="label-caps">{g.label}</p>
            <ul className="rail-list">
              {g.rows.map((r) => (
                <li key={r.key}>
                  <Link href={r.href} className="rail-row" onClick={onNavigate}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={(r.ar ? "ar-classical text-[15px] leading-[1.5]" : "text-[13px]") + " truncate"} lang={r.ar ? "ar" : "en"} dir="auto">
                        {r.title}
                      </span>
                    </span>
                  </Link>
                  {r.back && (
                    <Link href={r.back.href} className="rail-resume ps-2 hover:text-t1" onClick={onNavigate}>
                      <span className="dot" style={{ background: "var(--c-root)" }} />
                      {r.back.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      {client && mine.data?.length === 0 && (
        <Link href="/library?add=1" className="text-[12px] text-t3 hover:text-t1" onClick={onNavigate}>
          {t("textsAddMine")}
        </Link>
      )}
    </nav>
  );
}

/** The thirty ajzāʾ, each with its two aḥzāb, linked to where they begin (P2.1). */
function JuzList({ chapter, onNavigate }: { chapter: ChapterInfo; onNavigate: () => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["divisions"], queryFn: () => getJSON<{ juz: Division[]; hizb: Division[] }>("/divisions"), staleTime: Infinity });
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>("[data-current]")?.scrollIntoView({ block: "center" });
  }, [q.data]);
  if (!q.data) return <div className="h-40 animate-pulse rounded-lg bg-card-2" />;
  return (
    <ul ref={list} className="rail-list" aria-label={t("viewJuz")}>
      {q.data.juz.map((j) => {
        const hizb = q.data.hizb.filter((h) => h.juz === j.number);
        return (
          <li key={j.number} data-current={j.number === chapter.juz || undefined}>
            <Link href={`/quran/${j.surah}#v${j.ayah}`} className="rail-row" onClick={onNavigate}>
              <span className="mono w-[26px] text-[11px] text-t3">{formatNumber(j.number, locale)}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] text-t1">{t("juz", { n: formatNumber(j.number, locale) })}</span>
                <span className="truncate text-[10.5px] text-t3">{`${j.name_ar} ${formatNumber(j.ayah, locale)} • ${t("pageN", { n: formatNumber(j.page, locale) })}`}</span>
              </span>
            </Link>
            <span className="flex gap-1 ps-9 pb-1">
              {hizb.map((h) => (
                <Link key={h.number} href={`/quran/${h.surah}#v${h.ayah}`} className="chip text-[11px]" onClick={onNavigate} title={`${h.name_ar} ${formatNumber(h.ayah, locale)}`}>
                  {t("hizbN", { n: formatNumber(h.number, locale) })}
                </Link>
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Go to a mushaf page (1–604): the reader opens on its first verse. */
function PageJump({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("rd");
  const router = useRouter();
  const [page, setPage] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(page.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  const valid = Number.isInteger(n) && n >= 1 && n <= 604;
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setBusy(true);
        const d = await getJSON<{ verses: { key: string; surah: number; ayah: number }[] }>(`/pages/${n}`);
        setBusy(false);
        const v = d.verses[0];
        onNavigate();
        router.push(`/quran/${v.surah}#v${v.ayah}`);
      }}
    >
      <label className="flex flex-col gap-1 text-[12px] text-t2">
        {t("pageJumpLabel")}
        <input className="rail-search" inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} placeholder="١–٦٠٤" dir="auto" />
      </label>
      <button type="submit" className="btn" disabled={!valid || busy}>{t("pageJumpGo")}</button>
    </form>
  );
}
