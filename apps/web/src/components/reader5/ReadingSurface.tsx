"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAfterMount } from "@/lib/client";
import { formatNumber } from "@/lib/format";
import { usePersonal, usePrefs, useReader } from "@/lib/reader/store";
import { useAudio } from "@/lib/store/audio";
import type { ChapterInfo } from "./ReaderShell";
import { useDebounced } from "@/lib/useDebounced";
import { GrammarBand } from "./GrammarBand";
import { InlineGloss } from "./InlineGloss";
import { useSaved } from "@/lib/store/saved";
import { InlineLines } from "./InlineLines";
import { VerseDrawer, type DrawerTool } from "./VerseDrawer";

/**
 * Wraps the server-rendered sūra and owns its interaction through event delegation (design 03 §3.4):
 * word and verse clicks, the URL (?w=slug&at=location, ?v=2:255 — read and written, RDR-449/539),
 * selection and root-family underlines, word states (opt-in, D20), verse tools (hover, focus, 420 ms
 * long-press), drawers, reading progress and the resume marker, keyboard movement between words, and a
 * copy handler that puts the reference after the copied text.
 */
export type InitialSelection = { verse?: string; word?: { slug: string; at: string } };

export function ReadingSurface({ chapter, initial, children }: { chapter: ChapterInfo; initial?: InitialSelection; children: React.ReactNode }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const selection = useReader((s) => s.selection);
  const verse = useReader((s) => s.verse);
  const mode = useReader((s) => s.mode);
  const focusRoot = useReader((s) => s.focusRoot);
  const openWord = useReader((s) => s.openWord);
  const openVerse = useReader((s) => s.openVerse);
  const closeEntry = useReader((s) => s.closeEntry);
  const setMode = useReader((s) => s.setMode);
  const setCite = useReader((s) => s.setCite);
  const showToast = useReader((s) => s.showToast);
  const tintRoot = usePrefs((s) => s.tintRoot);
  const size = usePrefs((s) => s.size);
  const translitPref = usePrefs((s) => s.translitLine);
  const wordStatesOn = usePrefs((s) => s.wordStates);
  const grammarBand = usePrefs((s) => s.grammarBand);
  const panelOpen = usePrefs((s) => s.panelOpen);
  const notes = useSaved((s) => s.notes);
  const setPrefs = usePrefs((s) => s.set);
  const wordStates = usePersonal((s) => s.wordStates);
  const setWordState = usePersonal((s) => s.setWordState);
  const setProgress = usePersonal((s) => s.setProgress);
  const playVerse = useAudio((s) => s.playVerse);
  const [drawer, setDrawer] = useState<{ key: string; tool: DrawerTool } | null>(null);
  const arrival = useRef(false);
  const [hover, setHover] = useState<{ slug: string; at: string } | null>(null);
  const hoverIntent = useDebounced(hover, 140);
  const mounted = useAfterMount();
  // Where the last visit stopped in this sūra, captured once: reading on moves progress, not the marker.
  const [resume] = useState(() => {
    const prev = usePersonal.getState().progress.quran;
    return prev && prev.chapter === chapter.number && prev.passage > 1 ? { passage: prev.passage, at: prev.at } : null;
  });
  useEffect(() => {
    if (ref.current) roving(ref.current, null);
  }, []);

  // URL → state on arrival (a route's own verse or word first: /quran/2/255, /word/2:255:3); then the
  // resume marker from the last visit (shown, then the reader goes on).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const w = p.get("w") ?? initial?.word?.slug ?? null;
    const at = p.get("w") ? p.get("at") : (initial?.word?.at ?? null);
    const v = p.get("v") ?? initial?.verse ?? null;
    if (w || v) arrival.current = true;
    if (w) {
      openWord({ slug: w, at: at && at.startsWith(`${chapter.number}:`) ? at : null });
      setPrefs({ panelOpen: true });
    } else if (v && v.startsWith(`${chapter.number}:`)) {
      openVerse(v);
      setPrefs({ panelOpen: true });
    }
    const target = at ? `v${at.split(":")[1]}` : v ? `v${v.split(":")[1]}` : window.location.hash.slice(1);
    requestAnimationFrame(() => {
      const el = target ? document.getElementById(target) : resume ? document.getElementById(`v${resume.passage}`) : null;
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.setAttribute("data-target", "");
        setTimeout(() => el.removeAttribute("data-target"), 2400);
      }
    });
    // the route's initial selection is compared by value
  }, [chapter.number, openWord, openVerse, setPrefs, resume, initial?.verse, initial?.word?.slug, initial?.word?.at]);

  // State → URL, without navigation, once something changes: a verse of this sūra is its own path
  // (/quran/2/255), a word and the index are parameters on the sūra (?w=…&at=…, ?mode=lookup). Each
  // change is a history entry, so the browser's back and forward step through what was opened; the
  // selection applied on arrival only replaces the entry it came from.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const url = new URL(window.location.href);
    const prefix = /^\/en(\/|$)/.test(url.pathname) ? "/en" : "";
    url.pathname = `${prefix}/quran/${chapter.number}`;
    for (const k of ["w", "at", "v", "mode", "q"]) url.searchParams.delete(k);
    if (mode === "word" && selection) {
      url.searchParams.set("w", selection.slug);
      if (selection.at) url.searchParams.set("at", selection.at);
    } else if (mode === "verse" && verse) {
      const [s, a] = verse.split(":");
      if (Number(s) === chapter.number) url.pathname += `/${a}`;
      else url.searchParams.set("v", verse);
    } else if (mode === "index") url.searchParams.set("mode", "lookup");
    else if (mode === "surah") url.searchParams.set("mode", "about");
    if (url.href === window.location.href) return;
    // a word's own permalink (/word/2:255:3) stays in the address bar until the reader moves on
    if (arrival.current && /^(\/en)?\/word\//.test(window.location.pathname)) {
      arrival.current = false;
      return;
    }
    if (arrival.current) {
      arrival.current = false;
      window.history.replaceState(window.history.state, "", url.href);
    } else window.history.pushState(window.history.state, "", url.href);
  }, [mode, selection, verse, chapter.number]);

  // Back and forward: read the entry's URL back into the reader (another sūra is Next's navigation).
  useEffect(() => {
    function onPop() {
      const u = new URL(window.location.href);
      const m = u.pathname.match(/\/quran\/(\d+)(?:\/(\d+))?\/?$/);
      if (!m || Number(m[1]) !== chapter.number) return;
      const w = u.searchParams.get("w");
      const v = u.searchParams.get("v");
      const mode = u.searchParams.get("mode");
      const s = useReader.getState();
      if (m[2]) s.openVerse(`${m[1]}:${m[2]}`);
      else if (w) s.openWord({ slug: w, at: u.searchParams.get("at") }, { fromHistory: true });
      else if (v) s.openVerse(v);
      else if (mode === "lookup") s.setMode("index");
      else if (mode === "about") s.setMode("surah");
      else s.closeEntry();
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [chapter.number]);

  // Selection, root-family and focus-root underlines; the hot passage.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll(".is-selected, .is-family, .is-focus").forEach((el) => el.classList.remove("is-selected", "is-family", "is-focus"));
    root.querySelectorAll("[data-hot]").forEach((el) => el.removeAttribute("data-hot"));
    let familyRoot: string | undefined;
    if (mode === "word" && selection?.at) {
      const tokens = Array.from(root.querySelectorAll<HTMLElement>(".w")).filter((el) => covers(el, selection.at!));
      tokens.forEach((el) => el.classList.add("is-selected"));
      familyRoot = tokens[0]?.dataset.r;
      tokens[0]?.closest(".passage")?.setAttribute("data-hot", "");
      tokens[0]?.scrollIntoView({ block: "nearest" });
      // On phones the sheet covers the lower half: keep the tapped word above it (RDR-416).
      const word = tokens[0];
      const sheet = document.querySelector<HTMLElement>(".reader-sheet");
      if (word && sheet)
        requestAnimationFrame(() => {
          const r = word.getBoundingClientRect();
          const top = sheet.getBoundingClientRect().top;
          if (r.bottom > top - 12) root.closest(".reader-surface")?.scrollBy({ top: r.bottom - top + 64, behavior: "smooth" });
        });
      roving(root, tokens[0] ?? null);
    }
    if (mode === "verse" && verse) root.querySelector(`[data-verse="${CSS.escape(verse)}"]`)?.setAttribute("data-hot", "");
    if (tintRoot && familyRoot)
      root.querySelectorAll<HTMLElement>(`.w[data-r="${CSS.escape(familyRoot)}"]`).forEach((el) => !el.classList.contains("is-selected") && el.classList.add("is-family"));
    if (focusRoot) root.querySelectorAll<HTMLElement>(`.w[data-r="${CSS.escape(focusRoot)}"]`).forEach((el) => el.classList.add("is-focus"));
  }, [mode, selection, verse, tintRoot, focusRoot]);

  // The tool whose drawer is open reads as pressed.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll('.ptool[aria-pressed="true"]').forEach((el) => el.setAttribute("aria-pressed", "false"));
    if (drawer) root.querySelector(`.ptool[data-tool="${drawer.tool}"][data-verse-key="${CSS.escape(drawer.key)}"]`)?.setAttribute("aria-pressed", "true");
  }, [drawer]);

  // Word states drawn in the text only in study mode (D20); a known word carries no mark.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(".w").forEach((el) => {
      const st = el.dataset.l ? wordStates[el.dataset.l] : undefined;
      el.classList.toggle("is-learning", wordStatesOn && st === "learning");
      el.classList.toggle("is-new", wordStatesOn && !st && !!el.dataset.l);
    });
  }, [wordStates, wordStatesOn]);

  // Reading progress: the top-most verse in view (advances on reading, not only on taps — RDR-572).
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let last = 0;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        if (!visible.length) return;
        const ayah = Number((visible[0].dataset.verse ?? "").split(":")[1]);
        if (ayah && ayah !== last) {
          last = ayah;
          setProgress("quran", { chapter: chapter.number, passage: ayah });
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    root.querySelectorAll(".passage").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [chapter.number, setProgress]);

  // Arrow keys move between words in reading order; Esc closes the entry.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      // Esc closes the innermost layer only: a dialog, a term card or a popover handles its own Esc.
      if (e.key === "Escape" && !document.querySelector("[role=dialog]:not(.onboarding)")) {
        if (drawer) setDrawer(null);
        else closeEntry();
        return;
      }
      if (!el?.classList.contains("w") || !ref.current) return;
      const rtl = document.documentElement.dir === "rtl";
      const dir = e.key === (rtl ? "ArrowLeft" : "ArrowRight") ? 1 : e.key === (rtl ? "ArrowRight" : "ArrowLeft") ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const all = Array.from(ref.current.querySelectorAll<HTMLElement>(".w"));
      const next = all[all.indexOf(el) + dir];
      if (next) {
        roving(ref.current, next);
        next.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeEntry, drawer]);

  // Touch: a 420 ms long-press reveals a verse's tools; moving cancels it, so scrolling never does (RDR-149).
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null }>({ timer: null });
  function onTouchStart(e: React.TouchEvent) {
    const passage = (e.target as HTMLElement).closest<HTMLElement>(".passage");
    if (!passage) return;
    press.current.timer = setTimeout(() => {
      ref.current?.querySelectorAll("[data-pressed]").forEach((x) => x.removeAttribute("data-pressed"));
      passage.setAttribute("data-pressed", "");
    }, 420);
  }
  function cancelPress() {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
  }

  function onClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    const tool = el.closest<HTMLElement>("[data-tool]");
    if (tool) {
      runTool(tool.dataset.tool as DrawerTool | "audio" | "tafsir" | "copy" | "cite", tool.dataset.verseKey!);
      return;
    }
    if (el.closest("[data-about]")) {
      setMode("surah");
      setPrefs({ panelOpen: true });
      return;
    }
    const verseBtn = el.closest<HTMLElement>("[data-verse-btn]");
    if (verseBtn) {
      openVerse(verseBtn.dataset.verseBtn!);
      setPrefs({ panelOpen: true });
      return;
    }
    const w = el.closest<HTMLElement>(".w");
    if (w && !window.getSelection()?.toString()) {
      // A mushaf word holding two corpus words (لَّوۡمَا): a second tap opens the second.
      const second = selection?.at === w.dataset.w && w.dataset.w2;
      const at = second ? w.dataset.w2! : w.dataset.w!;
      const slug = second ? w.dataset.l2 : w.dataset.l;
      if (!slug) return;
      if (wordStatesOn && !usePersonal.getState().wordStates[slug]) setWordState(slug, "learning");
      openWord({ slug, at });
      setPrefs({ panelOpen: true });
    }
  }

  async function runTool(tool: DrawerTool | "audio" | "tafsir" | "copy" | "cite", key: string) {
    if (tool === "audio") return void playVerse(key);
    if (tool === "tafsir") {
      openVerse(key);
      setPrefs({ panelOpen: true });
      return;
    }
    if (tool === "cite") return setCite({ kind: "verse", key, label: key });
    if (tool === "copy") {
      const ayah = Number(key.split(":")[1]);
      const words = Array.from(ref.current?.querySelectorAll<HTMLElement>(`[data-verse="${CSS.escape(key)}"] .w`) ?? []).map((w) => w.textContent);
      const text = `﴿${words.join(" ")}﴾ [${chapter.nameAr}: ${formatNumber(ayah, "ar")}]`;
      try {
        await navigator.clipboard.writeText(text);
        showToast(t("verseCopied"));
      } catch {
        showToast(t("copyFailed"));
      }
      return;
    }
    setDrawer((d) => (d && d.key === key && d.tool === tool ? null : { key, tool }));
  }

  function onCopy(e: React.ClipboardEvent) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return;
    const range = sel.getRangeAt(0);
    const parts: string[] = [];
    const refs: number[] = [];
    for (const v of Array.from(ref.current.querySelectorAll<HTMLElement>(".passage"))) {
      if (!range.intersectsNode(v)) continue;
      const words = Array.from(v.querySelectorAll<HTMLElement>(".w")).filter((w) => range.intersectsNode(w));
      if (!words.length) continue;
      parts.push(words.map((w) => w.textContent).join(" "));
      refs.push(Number((v.dataset.verse ?? "").split(":")[1]));
    }
    if (!parts.length) return;
    const span = refs.length > 1 ? `${formatNumber(refs[0], "ar")}–${formatNumber(refs[refs.length - 1], "ar")}` : formatNumber(refs[0], "ar");
    e.clipboardData.setData("text/plain", `﴿${parts.join(" ")}﴾ [${chapter.nameAr}: ${span}]`);
    e.preventDefault();
  }

  // The grammar band follows the hovered word (after a short intent delay), else the selected one.
  function onMouseOver(e: React.MouseEvent) {
    if (!grammarBand) return;
    const w = (e.target as HTMLElement).closest<HTMLElement>(".w");
    const next = w?.dataset.l && w.dataset.w ? { slug: w.dataset.l, at: w.dataset.w } : null;
    if (next?.at !== hover?.at) setHover(next);
  }
  const bandWord = grammarBand ? (hoverIntent ?? (mode === "word" && selection?.at ? { slug: selection.slug, at: selection.at } : null)) : null;
  const bandEl = mounted && bandWord ? document.querySelector(`[data-band="${CSS.escape(bandWord.at.split(":").slice(0, 2).join(":"))}"]`) : null;

  // Phone with the sheet put away: the selected word's gloss stands under its verse (RDR-605).
  const phone = mounted && document.querySelector(".reader-v5")?.getAttribute("data-bp") === "phone";
  const glossEl =
    phone && !panelOpen && mode === "word" && selection?.at?.startsWith(`${chapter.number}:`)
      ? document.querySelector(`[data-gloss="${CSS.escape(selection.at.split(":").slice(0, 2).join(":"))}"]`)
      : null;

  const translitOn = translitPref ?? locale !== "ar";
  const resumeEl = mounted && resume ? document.querySelector(`#v${resume.passage} .passage-label`) : null;
  const drawerEl = mounted && drawer ? document.querySelector(`[data-drawer="${CSS.escape(drawer.key)}"]`) : null;

  return (
    <div
      ref={ref}
      className="reading"
      data-translit={translitOn ? "on" : "off"}
      data-grammar={grammarBand ? "on" : undefined}
      style={{ ["--size" as string]: String(size), ["--band-hint" as string]: JSON.stringify(t("bandHint")) }}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseLeave={() => setHover(null)}
      onCopy={onCopy}
      onTouchStart={onTouchStart}
      onTouchMove={cancelPress}
      onTouchEnd={cancelPress}
      onFocus={(e) => {
        // the first Tab into the text lands on one word; arrows move from there
        if ((e.target as HTMLElement).classList.contains("w")) roving(ref.current!, e.target as HTMLElement);
      }}
    >
      {children}
      {mounted && <InlineLines chapter={chapter.number} />}
      {resumeEl &&
        createPortal(
          <span className="resume-mark">
            <span className="dot" style={{ background: "var(--c-root)" }} />
            {t("youStoppedHere", { date: new Date(resume!.at).toLocaleDateString(locale === "ar" ? "ar" : "en-GB", { day: "numeric", month: "long" }) })}
          </span>,
          resumeEl,
        )}
      {glossEl && selection?.at && createPortal(<InlineGloss key={selection.at} slug={selection.slug} at={selection.at} />, glossEl)}
      {mounted &&
        Object.values(notes)
          .filter((n) => n.verse.startsWith(`${chapter.number}:`))
          .map((n) => {
            const slot = document.querySelector(`[data-note="${CSS.escape(n.verse)}"]`);
            return slot
              ? createPortal(
                  <button type="button" className="margin-note" data-tool="note" data-verse-key={n.verse}>
                    <em>{t("noteMark")}</em>
                    <span className="line-clamp-2 flex-1" dir="auto">{n.text}</span>
                  </button>,
                  slot,
                  `note-${n.verse}`,
                )
              : null;
          })}
      {bandEl && bandWord && createPortal(<GrammarBand key={bandWord.at} slug={bandWord.slug} at={bandWord.at} />, bandEl)}
      {drawerEl && drawer && createPortal(<VerseDrawer verseKey={drawer.key} tool={drawer.tool} onClose={() => setDrawer(null)} />, drawerEl)}
    </div>
  );
}

function covers(el: HTMLElement, location: string): boolean {
  if (el.dataset.w === location || el.dataset.w2 === location) return true;
  if (!el.dataset.w2) return false;
  const [s, a, from] = el.dataset.w!.split(":").map(Number);
  const to = Number(el.dataset.w2.split(":")[2]);
  const [ls, la, lw] = location.split(":").map(Number);
  return ls === s && la === a && lw >= from && lw <= to;
}

/** One word in the text is tabbable at a time (a roving tabindex): the selected or last-focused one. */
function roving(root: HTMLElement, el: HTMLElement | null) {
  root.querySelectorAll<HTMLElement>(".w[tabindex='0']").forEach((x) => x.setAttribute("tabindex", "-1"));
  (el ?? root.querySelector<HTMLElement>(".w"))?.setAttribute("tabindex", "0");
}
