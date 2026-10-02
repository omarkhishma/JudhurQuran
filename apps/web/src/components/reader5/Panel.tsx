"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useDebounced } from "@/lib/useDebounced";
import { getJSON, useSurahRoots, useWord } from "@/lib/reader/api";
import { usePrefs, useReader } from "@/lib/reader/store";
import type { ChapterInfo } from "./ReaderShell";
import { WordEntry } from "./WordEntry";
import { VerseEntry } from "./VerseEntry";
import { IndexBody } from "./IndexBody";
import { SurahAbout } from "./SurahAbout";

const MIN_W = 320;

/**
 * The dictionary panel (design 03 §3.5, inventory RDR-189…210): docked and resizable on desktop, a
 * bottom sheet with a grabber on phones (half / full, swipe; never under the header — RDR-532).
 */
export function Panel({ chapter, docked, width }: { chapter: ChapterInfo; docked: boolean; width: number }) {
  const t = useTranslations("rd");
  const mode = useReader((s) => s.mode);
  const selection = useReader((s) => s.selection);
  const verse = useReader((s) => s.verse);
  const history = useReader((s) => s.history);
  const cursor = useReader((s) => s.cursor);
  const back = useReader((s) => s.back);
  const forward = useReader((s) => s.forward);
  const setMode = useReader((s) => s.setMode);
  const sheet = useReader((s) => s.sheet);
  const setSheet = useReader((s) => s.setSheet);
  const closeEntry = useReader((s) => s.closeEntry);
  const setPrefs = usePrefs((s) => s.set);
  const word = useWord(mode === "word" ? selection?.slug ?? null : null, selection?.at ?? null);
  const body = useRef<HTMLDivElement>(null);

  // On phones the sheet only exists while something is open (a persisted "open" never covers the text on load).
  if (!docked && mode === "empty") return null;

  const title =
    mode === "word" && word.data
      ? t("entryTitle", { tr: word.data.ar.translit })
      : mode === "index"
        ? t("allEntries")
        : mode === "verse" && verse
          ? t("verseTitle", { ref: verse })
          : mode === "surah"
            ? t("aboutSurah")
            : t("dictionary");

  function close() {
    if (docked) setPrefs({ panelOpen: false });
    else closeEntry();
  }

  return (
    <aside
      className={docked ? "reader-panel" : "reader-sheet"}
      data-sheet={docked ? undefined : sheet}
      style={docked ? { width: Math.max(MIN_W, width) } : undefined}
      aria-label={t("dictionary")}
    >
      {docked ? <ResizeHandle /> : <Grabber sheet={sheet} setSheet={setSheet} onClose={closeEntry} />}
      <div className="panel-top">
        <button type="button" className="panel-icon" onClick={back} disabled={cursor <= 0} aria-label={t("back")} title={t("back")}>
          <Icon name="chevronStart" size={14} />
        </button>
        <button type="button" className="panel-icon" onClick={forward} disabled={cursor >= history.length - 1} aria-label={t("forward")} title={t("forward")}>
          <Icon name="chevronEnd" size={14} />
        </button>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-t1">{title}</span>
        <button type="button" className="hdr-btn" aria-pressed={mode === "index"} onClick={() => setMode(mode === "index" ? (selection ? "word" : "empty") : "index")} title={t("indexTitle")}>
          {t("index")}
        </button>
        <button type="button" className="panel-icon" onClick={close} aria-label={t("hidePanel")} title={t("hidePanel")}>
          <Icon name="close" size={13} />
        </button>
      </div>
      <PanelSearch />
      <div ref={body} className="panel-body">
        {mode === "word" && selection && <WordEntry query={word} chapter={chapter} bodyRef={body} />}
        {mode === "verse" && verse && <VerseEntry verseKey={verse} />}
        {mode === "index" && <IndexBody />}
        {mode === "surah" && <SurahAbout chapter={chapter} />}
        {mode === "empty" && <EmptyBody chapter={chapter} />}
      </div>
    </aside>
  );
}

function ResizeHandle() {
  const t = useTranslations("rd");
  const setPrefs = usePrefs((s) => s.set);
  const panelW = usePrefs((s) => s.panelW);
  function onDown(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const start = panelW;
    const rtl = document.documentElement.dir === "rtl";
    const cap = () => Math.max(MIN_W, window.innerWidth - (window.innerWidth >= 1200 ? 240 : 0) - 420);
    function move(ev: PointerEvent) {
      // The panel sits on the inline-end side: dragging toward the text widens it in either direction.
      const delta = rtl ? ev.clientX - startX : startX - ev.clientX;
      setPrefs({ panelW: Math.round(Math.min(cap(), Math.max(MIN_W, start + delta))) });
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  function onKey(e: React.KeyboardEvent) {
    const rtl = document.documentElement.dir === "rtl";
    const step = e.key === (rtl ? "ArrowRight" : "ArrowLeft") ? 24 : e.key === (rtl ? "ArrowLeft" : "ArrowRight") ? -24 : 0;
    if (!step) return;
    e.preventDefault();
    setPrefs({ panelW: Math.max(MIN_W, panelW + step) });
  }
  return (
    <div
      className="panel-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label={t("resize")}
      aria-valuenow={panelW}
      tabIndex={0}
      title={t("resize")}
      onPointerDown={onDown}
      onKeyDown={onKey}
    />
  );
}

function Grabber({ sheet, setSheet, onClose }: { sheet: "half" | "full"; setSheet: (s: "half" | "full") => void; onClose: () => void }) {
  const t = useTranslations("rd");
  const startY = useRef<number | null>(null);
  return (
    <button
      type="button"
      className="sheet-grabber"
      aria-label={sheet === "half" ? t("expandSheet") : t("shrinkSheet")}
      onClick={() => setSheet(sheet === "half" ? "full" : "half")}
      onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
      onTouchEnd={(e) => {
        if (startY.current === null) return;
        const dy = e.changedTouches[0].clientY - startY.current;
        startY.current = null;
        if (dy < -40) setSheet("full");
        else if (dy > 40) {
          if (sheet === "full") setSheet("half");
          else onClose();
        }
      }}
    >
      <span aria-hidden="true" />
    </button>
  );
}

type SearchLemma = { slug: string; ar: string; envelope: { full: string; translit: string }; gloss_en: string | null; senses_en?: string[]; root: string | null; pos_label?: { ar: string; en: string } };

function PanelSearch() {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 200);
  const openWord = useReader((s) => s.openWord);
  const res = useQuery({
    queryKey: ["panel-search", dq],
    queryFn: () => getJSON<{ results: { lemmas: SearchLemma[] } }>(`/search?q=${encodeURIComponent(dq)}&limit=9`),
    enabled: dq.length > 0,
  });
  const items = res.data?.results.lemmas ?? [];
  return (
    <div className="panel-searchbar">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQ("");
          if (e.key === "Enter" && items[0]) {
            openWord({ slug: items[0].slug, at: null });
            setQ("");
          }
        }}
        placeholder={t("panelSearchPlaceholder")}
        aria-label={t("panelSearchLabel")}
        className="panel-search"
        dir="auto"
      />
      {dq && (
        <ul className="popover panel-results" aria-label={t("panelSearchLabel")}>
          {res.isFetched && items.length === 0 && <li className="px-3 py-2 text-[12.5px] text-t3">{t("noResults")}</li>}
          {items.map((x) => (
            <li key={x.slug}>
              <button
                type="button"
                className="panel-result"
                onClick={() => {
                  openWord({ slug: x.slug, at: null });
                  setQ("");
                }}
              >
                <span className="ar-classical min-w-[76px] text-[19px] leading-[1.6]" lang="ar" dir="rtl">{x.ar}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-t2" lang={locale === "ar" ? undefined : "en"}>
                  {x.gloss_en ?? x.senses_en?.[0] ?? ""}
                </span>
                <span className="mono text-[11px] text-t3" dir="ltr">{x.envelope.translit}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyBody({ chapter }: { chapter: ChapterInfo }) {
  const t = useTranslations("rd");
  const roots = useSurahRoots(chapter.number);
  const setFocusRoot = useReader((s) => s.setFocusRoot);
  return (
    <div className="flex flex-col gap-3 p-4">
      <h2 className="text-[14.5px] font-medium text-t1">{t("emptyTitle")}</h2>
      <p className="text-[13px] leading-relaxed text-t2">{t("emptyBody")}</p>
      <ul className="flex flex-wrap gap-3 text-[12px] text-t2" aria-label={t("legend")}>
        <li className="flex items-center gap-1.5"><span className="dot" style={{ background: "var(--c-root)" }} />{t("typeRoot")}</li>
        <li className="flex items-center gap-1.5"><span className="dot" style={{ background: "var(--c-form)" }} />{t("typePattern")}</li>
        <li className="flex items-center gap-1.5"><span className="dot" style={{ background: "var(--c-word)" }} />{t("typeWord")}</li>
        <li className="flex items-center gap-1.5"><span className="dot" style={{ background: "var(--c-sentence)" }} />{t("typeVerse")}</li>
      </ul>
      <hr className="border-line" />
      <p className="label-caps">{t("startFromRoot")}</p>
      <div className="flex flex-wrap gap-2">
        {(roots.data?.data ?? []).slice(0, 12).map((r) => (
          <button key={r.key} type="button" className="chip" onClick={() => setFocusRoot(r.key)} title={t("highlightRootTitle", { root: r.spaced })}>
            <span className="ar-classical text-[17px] tracking-[.06em] text-root" lang="ar">{r.spaced}</span>
            <span className="mono text-[10.5px] text-t3" dir="ltr">{r.translit}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
