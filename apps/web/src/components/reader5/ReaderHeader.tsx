"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Link } from "@/i18n/navigation";
import { setLocalStorage, useTheme } from "@/lib/client";
import { cnt, formatNumber } from "@/lib/format";
import { useBreakpoint } from "@/lib/reader/media";
import { usePersonal, usePrefs, useReader } from "@/lib/reader/store";
import { THEME_KEY } from "@/lib/site";
import type { ChapterInfo } from "./ReaderShell";
import { ReadingPrefs } from "./ReadingPrefs";
import { useDueCount } from "./ReviewDeck";

const SIZE_MIN = 0.8;
const SIZE_MAX = 1.6;

/** The reader's bespoke header (design 03 §3.2, inventory RDR-016…031), mirrored for Arabic. */
export function ReaderHeader({ chapter, surfaceRef }: { chapter: ChapterInfo; surfaceRef: React.RefObject<HTMLDivElement | null> }) {
  const t = useTranslations("rd");
  const tr = useTranslations("review");
  const locale = useLocale();
  const bp = useBreakpoint();
  const theme = useTheme();
  const size = usePrefs((s) => s.size);
  const railOpen = usePrefs((s) => s.railOpen);
  const panelOpen = usePrefs((s) => s.panelOpen);
  const wordStatesOn = usePrefs((s) => s.wordStates);
  const explainTerms = usePrefs((s) => s.explainTerms);
  const setPrefs = usePrefs((s) => s.set);
  const ask = useReader((s) => s.ask);
  const setAsk = useReader((s) => s.setAsk);
  const setOmnibox = useReader((s) => s.setOmnibox);
  const setReview = useReader((s) => s.setReview);
  const setRailOverlay = useReader((s) => s.setRailOverlay);
  const railOverlay = useReader((s) => s.railOverlay);
  const selection = useReader((s) => s.selection);
  // the roots due now by the scheduler, not the size of a queue (RDR-346)
  const due = useDueCount();
  const wordStates = usePersonal((s) => s.wordStates);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // closed with Esc, a popover hands focus back to the button that opened it (RDR-461)
  const prefsBtn = useRef<HTMLButtonElement>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const closePrefs = (how?: "key" | "pointer") => {
    setPrefsOpen(false);
    if (how === "key") (prefsBtn.current ?? moreBtn.current)?.focus();
  };
  const [progress, setProgress] = useState(0);
  const [page, setPage] = useState<number | null>(null);
  const wide = bp !== "phone";

  // Reading-position hairline: how far through the sūra the reader has scrolled.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
      // the mushaf page of the verse at the top of the reading area (position in the whole mushaf)
      const edge = el.getBoundingClientRect().top + 40;
      const top = Array.from(el.querySelectorAll<HTMLElement>(".passage[data-page]")).find((p) => p.getBoundingClientRect().bottom > edge);
      setPage(top ? Number(top.dataset.page) : null);
    };
    // once per frame at most: the page lookup measures the verses
    let frame = 0;
    const throttled = () => {
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        onScroll();
      });
    };
    onScroll();
    el.addEventListener("scroll", throttled, { passive: true });
    return () => {
      el.removeEventListener("scroll", throttled);
      cancelAnimationFrame(frame);
    };
  }, [surfaceRef]);

  function setSize(next: number) {
    setPrefs({ size: Math.round(Math.min(SIZE_MAX, Math.max(SIZE_MIN, next)) * 100) / 100 });
  }
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setLocalStorage(THEME_KEY, next);
  }
  function toggleRail() {
    if (bp === "wide") setPrefs({ railOpen: !railOpen });
    else setRailOverlay(!railOverlay);
  }
  function toggleAsk() {
    if (ask) {
      setAsk(false);
      setPrefs({ panelOpen: true });
    } else {
      setAsk(true);
    }
  }

  const learning = Object.values(wordStates).filter((s) => s === "learning").length;
  const known = Object.values(wordStates).filter((s) => s === "known").length;
  const place = chapter.place === "meccan" ? t("meccan") : t("medinan");
  const meta = [place, t("verses", cnt(chapter.verseCount, locale)), t("juz", { n: formatNumber(chapter.juz, locale) })];
  if (wordStatesOn) meta.push(t("knownLearning", { known: formatNumber(known, locale), learning: formatNumber(learning, locale) }));
  const setHandoff = useReader((s) => s.setHandoff);
  // with a word selected the graph button hands that word to the editor (RDR-028, 361); otherwise it opens the editor
  const handoff = selection?.slug ? () => setHandoff({ seed: "word", slug: selection.slug, at: selection.at }) : null;

  return (
    <header className="reader-header">
      <button type="button" className="hdr-btn hdr-square" onClick={toggleRail} aria-label={t("toggleContents")} title={t("toggleContentsTitle")} aria-expanded={bp === "wide" ? railOpen : railOverlay}>
        <Icon name="menu" size={14} />
      </button>
      <Link href="/" className="flex shrink-0 items-center" aria-label={t("home")}>
        <span className="block h-[18px] w-[18px] rounded-[5px] bg-root" aria-hidden="true" />
      </Link>
      <div className="flex min-w-0 max-w-[260px] flex-col leading-tight">
        <span className="ar-classical truncate text-[15px] leading-[1.35] text-t1" lang="ar" dir="rtl">
          {`سورة ${chapter.nameAr}`}
        </span>
        <span className="truncate text-[11px] text-t3">{meta.join(" • ")}</span>
      </div>
      <span className="flex-1" />
      {wide && (
        <div className="ctrl-group" role="group" aria-label={t("textSize")}>
          <button type="button" onClick={() => setSize(size - 0.1)} aria-label={t("smaller")} title={t("smaller")} disabled={size <= SIZE_MIN}>
            <span className="text-[11.5px]">A−</span>
          </button>
          <span className="mono min-w-[38px] text-center text-[11.5px] text-t3" dir="ltr">{`${Math.round(size * 100)}%`}</span>
          <button type="button" onClick={() => setSize(size + 0.1)} aria-label={t("larger")} title={t("larger")} disabled={size >= SIZE_MAX}>
            <span className="text-[13.5px]">A+</span>
          </button>
        </div>
      )}
      <button type="button" className="hdr-btn" aria-pressed={ask} onClick={toggleAsk} title={t("askTitle")}>
        {t("ask")}
      </button>
      {wide && (
        <button type="button" className="hdr-btn min-w-[120px] justify-between" onClick={() => setOmnibox(true)} title={t("searchTitle")} aria-keyshortcuts="Meta+K Control+K">
          <span className="flex items-center gap-1.5 text-t3">
            <Icon name="search" size={13} />
            {t("search")}
          </span>
          <kbd className="mono rounded border border-line px-1 text-[10.5px] text-t3" dir="ltr">⌘K</kbd>
        </button>
      )}
      {wide && (
        <button type="button" className="hdr-btn" onClick={() => setReview(true)} title={t("reviewTitle")}>
          <Icon name="calendar" size={13} />
          {t("review")}
          {due != null && (
            <span className={"mono rounded-[5px] px-1.5 text-[11px] " + (due ? "bg-root-wash text-root" : "bg-card-2 text-t3")} aria-label={tr("badge", cnt(due, locale))}>
              {formatNumber(due, locale)}
            </span>
          )}
        </button>
      )}
      {wide && (
        <div className="relative">
          <button ref={prefsBtn} type="button" className="hdr-btn" aria-expanded={prefsOpen} onClick={() => setPrefsOpen((v) => !v)} title={t("readingTitle")}>
            <Icon name="sliders" size={13} />
            {t("reading")}
          </button>
          {prefsOpen && <ReadingPrefs onClose={closePrefs} />}
        </div>
      )}
      {wide && (
        <button
          type="button"
          className="hdr-btn hdr-icon"
          aria-pressed={explainTerms}
          onClick={() => setPrefs({ explainTerms: !explainTerms })}
          aria-label={t("prefExplain")}
          title={t("prefExplainHint")}
        >
          <Icon name="info" size={14} />
        </button>
      )}
      {wide && (
        <button type="button" className="hdr-btn hdr-icon" onClick={toggleTheme} aria-pressed={theme === "dark"} aria-label={theme === "dark" ? t("themeLight") : t("themeDark")} title={theme === "dark" ? t("themeLight") : t("themeDark")}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
        </button>
      )}
      {wide && (
        handoff ? (
          <button type="button" className="hdr-btn" onClick={handoff} title={t("graphWordTitle")}>
            <Icon name="graph" size={13} />
            {t("graph")}
          </button>
        ) : (
          <Link href="/graph" className="hdr-btn" title={t("graphTitle")}>
            <Icon name="graph" size={13} />
            {t("graph")}
          </Link>
        )
      )}
      {!wide && (
        <div className="relative">
          <button ref={moreBtn} type="button" className="hdr-btn hdr-more" aria-label={t("more")} aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
            ⋯
          </button>
          {moreOpen && (
            <MoreMenu
              onClose={(how) => {
                setMoreOpen(false);
                if (how === "key") moreBtn.current?.focus();
              }}
              onPrefs={() => {
                setMoreOpen(false);
                setPrefsOpen(true);
              }}
              size={size}
              setSize={setSize}
              theme={theme}
              toggleTheme={toggleTheme}
              onGraph={handoff}
            />
          )}
          {prefsOpen && <ReadingPrefs onClose={closePrefs} />}
        </div>
      )}
      <button
        type="button"
        className="hdr-btn"
        aria-pressed={panelOpen && !ask}
        onClick={() => {
          // from Ask, the dictionary button leaves Ask for the reading view with the panel open
          if (ask) {
            setAsk(false);
            setPrefs({ panelOpen: true });
          } else setPrefs({ panelOpen: !panelOpen });
        }}
        title={t("dictionaryTitle")}
        aria-keyshortcuts="Alt+P"
      >
        <Icon name="book" size={13} />
        {t("dictionary")}
      </button>
      <span
        className="reader-hairline"
        style={{ width: `${progress * 100}%` }}
        role="progressbar"
        aria-label={t("readingPosition")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={t("positionText", {
          surah: new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "percent", maximumFractionDigits: 0 }).format(progress),
          page: formatNumber(page ?? 1, locale),
          mushaf: new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "percent", maximumFractionDigits: 0 }).format((page ?? 1) / 604),
        })}
        title={t("positionText", {
          surah: new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "percent", maximumFractionDigits: 0 }).format(progress),
          page: formatNumber(page ?? 1, locale),
          mushaf: new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { style: "percent", maximumFractionDigits: 0 }).format((page ?? 1) / 604),
        })}
      />
    </header>
  );
}

function MoreMenu({
  onClose,
  onPrefs,
  size,
  setSize,
  theme,
  toggleTheme,
  onGraph,
}: {
  onClose: (how?: "key" | "pointer") => void;
  onPrefs: () => void;
  size: number;
  setSize: (n: number) => void;
  theme: "light" | "dark" | null;
  toggleTheme: () => void;
  onGraph: (() => void) | null;
}) {
  const t = useTranslations("rd");
  const box = useRef<HTMLDivElement>(null);
  const setOmnibox = useReader((s) => s.setOmnibox);
  const setReview = useReader((s) => s.setReview);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("button,a")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose("key");
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && onClose("pointer");
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);
  return (
    <div ref={box} className="popover more-menu" role="menu" aria-label={t("more")}>
      <button type="button" role="menuitem" onClick={() => { onClose(); setOmnibox(true); }}>
        {t("searchEverything")} <span aria-hidden="true">⌕</span>
      </button>
      <button type="button" role="menuitem" onClick={onPrefs}>
        {t("readingTitle")} <span aria-hidden="true">Aa</span>
      </button>
      <button type="button" role="menuitem" onClick={() => setSize(size + 0.1)}>
        {t("larger")} <span aria-hidden="true">A+</span>
      </button>
      <button type="button" role="menuitem" onClick={() => setSize(size - 0.1)}>
        {t("smaller")} <span aria-hidden="true">A−</span>
      </button>
      <button type="button" role="menuitem" onClick={() => { onClose(); setReview(true); }}>
        {t("reviewRoots")}
      </button>
      <ExplainItem onClose={onClose} />
      <button type="button" role="menuitem" onClick={() => { toggleTheme(); onClose(); }}>
        {theme === "dark" ? t("themeLight") : t("themeDark")}
      </button>
      {onGraph ? (
        <button type="button" role="menuitem" onClick={() => { onClose(); onGraph(); }}>
          {t("graphEditor")} <span aria-hidden="true" className="rtl:-scale-x-100 inline-block">→</span>
        </button>
      ) : (
        <Link href="/graph" role="menuitem" onClick={() => onClose()}>
          {t("graphEditor")} <span aria-hidden="true" className="rtl:-scale-x-100 inline-block">→</span>
        </Link>
      )}
      <Link href="/library" role="menuitem" onClick={() => onClose()}>
        {t("library")} <span aria-hidden="true" className="rtl:-scale-x-100 inline-block">→</span>
      </Link>
      {/* the account, from the reader as from every page (P6): signed in or not, the Profile holds it */}
      <Link href="/me" role="menuitem" onClick={() => onClose()}>
        {t("account")}
      </Link>
    </div>
  );
}

function ExplainItem({ onClose }: { onClose: () => void }) {
  const t = useTranslations("rd");
  const on = usePrefs((s) => s.explainTerms);
  const set = usePrefs((s) => s.set);
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => { set({ explainTerms: !on }); onClose(); }}>
      {t("prefExplain")} <span aria-hidden="true">{on ? "✓" : ""}</span>
    </button>
  );
}
