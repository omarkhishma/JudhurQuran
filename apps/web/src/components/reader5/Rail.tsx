"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { normalize } from "@/lib/arabic/normalize";
import { cnt, formatNumber } from "@/lib/format";
import { getJSON, useSurahRoots } from "@/lib/reader/api";
import { useReader } from "@/lib/reader/store";
import type { ChapterInfo } from "./ReaderShell";

type SurahRow = { number: number; name_ar: string; name_translit: string; name_en: string; revelation_place: string; verse_count: number; juz_start: number; page_start: number };

/**
 * The rail (design 03 §3.4, adapted per RDR-541): the sūra index with juzʾ navigation in place of the
 * prototype's library + chapters, and the roots of this sūra — a tap underlines every word built on it.
 */
export function Rail({ chapter, overlay, onNavigate }: { chapter: ChapterInfo; overlay: boolean; onNavigate: () => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const list = useRef<HTMLUListElement>(null);
  const surahs = useQuery({ queryKey: ["surahs"], queryFn: () => getJSON<{ data: SurahRow[] }>("/surahs"), staleTime: Infinity });
  const roots = useSurahRoots(chapter.number);
  const focusRoot = useReader((s) => s.focusRoot);
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
        <p className="label-caps">{t("surahIndex")}</p>
        <Link href="/library" className="text-[11px] text-t3 hover:text-t1">{t("allTexts")}</Link>
      </div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("findSurah")}
        aria-label={t("findSurah")}
        className="rail-search"
        dir="auto"
      />
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
                    {(s.revelation_place === "meccan" ? t("meccan") : t("medinan")) + " · " + t("verses", cnt(s.verse_count, locale))}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <hr className="border-line" />
      <div className="flex items-center justify-between">
        <p className="label-caps">{t("rootsOfSurah")}</p>
        {focusRoot && (
          <button type="button" className="text-[11px] text-t3 hover:text-bad" onClick={() => setFocusRoot(null)} title={t("clearHighlightTitle")}>
            {t("clear")}
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-0.5" aria-label={t("rootsOfSurah")}>
        {(roots.data?.data ?? []).slice(0, 60).map((r) => {
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
                <span className="rail-bar" aria-hidden="true">
                  <span style={{ width: `${(r.here / max) * 100}%` }} />
                </span>
                <span className="mono text-[11px] text-t3">{formatNumber(r.here, locale)}×</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
