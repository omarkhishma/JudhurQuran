"use client";

import { useEffect, useRef } from "react";
import { usePrefs, useReader } from "@/lib/store/reader";
import { writeProgress } from "@/lib/personal";

/**
 * Wraps the server-rendered verse list and owns all interaction through event delegation:
 * word and verse-number clicks, selection and same-root highlighting, URL sync (?w= / ?v=),
 * keyboard navigation between words, reading progress, and a copy handler that never puts
 * verse numbers into copied Quranic text.
 */
export function ReaderController({
  children,
  surah,
  surahName,
}: {
  children: React.ReactNode;
  surah: number;
  surahName: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const panel = useReader((s) => s.panel);
  const openWord = useReader((s) => s.openWord);
  const openVerse = useReader((s) => s.openVerse);
  const close = useReader((s) => s.close);
  const highlightRoot = usePrefs((s) => s.highlightRoot);
  const scale = usePrefs((s) => s.scale);
  const layout = usePrefs((s) => s.layout);

  // Open from the URL on first load (?w=2:255:3 or ?v=2:255), and honour #v255.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get("w");
    const v = params.get("v");
    if (w && w.startsWith(`${surah}:`)) openWord(w);
    else if (v && v.startsWith(`${surah}:`)) openVerse(v);
    const target = w ? `v${w.split(":")[1]}` : v ? `v${v.split(":")[1]}` : window.location.hash.slice(1);
    if (target) {
      const el = document.getElementById(target);
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.classList.add("is-target");
        setTimeout(() => el.classList.remove("is-target"), 2400);
      }
    }
    return () => close();
  }, [surah, openWord, openVerse, close]);

  // Reflect the open panel in the URL without a navigation — only after the panel actually changes,
  // so the initial render never wipes a ?w= / ?v= that is about to be read.
  const prevPanel = useRef<typeof panel | undefined>(undefined);
  useEffect(() => {
    const first = prevPanel.current === undefined;
    prevPanel.current = panel;
    if (first && panel === null) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("w");
    url.searchParams.delete("v");
    if (panel?.kind === "word") url.searchParams.set("w", panel.location);
    if (panel?.kind === "verse") url.searchParams.set("v", panel.key);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url.href);
  }, [panel]);

  // Selection + same-root highlighting.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll(".is-selected, .is-root, .is-verse-selected").forEach((el) => {
      el.classList.remove("is-selected", "is-root", "is-verse-selected");
    });
    if (panel?.kind === "word") {
      const tokens = Array.from(root.querySelectorAll<HTMLElement>(".w")).filter((el) => covers(el, panel.location));
      tokens.forEach((el) => el.classList.add("is-selected"));
      const rootKey = tokens[0]?.dataset.r;
      if (highlightRoot && rootKey) {
        root.querySelectorAll<HTMLElement>(`.w[data-r="${CSS.escape(rootKey)}"]`).forEach((el) => {
          if (!el.classList.contains("is-selected")) el.classList.add("is-root");
        });
      }
      tokens[0]?.scrollIntoView({ block: "nearest" });
    }
    if (panel?.kind === "verse") {
      root.querySelector(`[data-verse="${CSS.escape(panel.key)}"]`)?.classList.add("is-verse-selected");
    }
  }, [panel, highlightRoot]);

  // Reading progress: remember the top-most visible verse.
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
          writeProgress({ surah, ayah });
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    root.querySelectorAll(".verse").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [surah]);

  // Keyboard: Esc closes; arrows move between words in reading order.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "Escape") {
        close();
        return;
      }
      if (panel?.kind !== "word" || !ref.current) return;
      const rtl = document.documentElement.dir === "rtl";
      const forward = e.key === (rtl ? "ArrowLeft" : "ArrowRight");
      const backward = e.key === (rtl ? "ArrowRight" : "ArrowLeft");
      if (!forward && !backward) return;
      e.preventDefault();
      const next = stepWord(ref.current, panel.location, forward ? 1 : -1);
      if (next) openWord(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, close, openWord]);

  function onClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    const verseBtn = el.closest<HTMLElement>("[data-verse-btn]");
    if (verseBtn) {
      openVerse(verseBtn.dataset.verseBtn!);
      return;
    }
    const w = el.closest<HTMLElement>(".w");
    if (w && !window.getSelection()?.toString()) {
      // When one mushaf word holds two corpus words (لَّوۡمَا), a second tap on it opens the second.
      const loc =
        panel?.kind === "word" && panel.location === w.dataset.w && w.dataset.w2 ? w.dataset.w2 : w.dataset.w!;
      openWord(loc);
    }
  }

  function onCopy(e: React.ClipboardEvent) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return;
    const range = sel.getRangeAt(0);
    const verses = Array.from(ref.current.querySelectorAll<HTMLElement>(".verse"));
    const parts: string[] = [];
    const refs: number[] = [];
    for (const v of verses) {
      if (!range.intersectsNode(v)) continue;
      const words = Array.from(v.querySelectorAll<HTMLElement>(".w")).filter((w) => range.intersectsNode(w));
      if (!words.length) continue;
      parts.push(words.map((w) => w.textContent).join(" "));
      refs.push(Number((v.dataset.verse ?? "").split(":")[1]));
    }
    if (!parts.length) return;
    const span = refs.length > 1 ? `${refs[0]}–${refs[refs.length - 1]}` : `${refs[0]}`;
    const text = `﴿${parts.join(" ")}﴾ [${surahName}: ${span}]`;
    e.clipboardData.setData("text/plain", text);
    e.preventDefault();
  }

  return (
    <div
      ref={ref}
      className="reader-text"
      data-layout={layout}
      style={{ ["--reading-scale" as string]: String(scale) }}
      onClick={onClick}
      onCopy={onCopy}
    >
      {children}
    </div>
  );
}

function covers(el: HTMLElement, location: string): boolean {
  if (el.dataset.w === location || el.dataset.w2 === location) return true;
  if (!el.dataset.w2) return false;
  // a token spanning words a..b covers every word between them
  const [s, a, from] = el.dataset.w!.split(":").map(Number);
  const to = Number(el.dataset.w2.split(":")[2]);
  const [ls, la, lw] = location.split(":").map(Number);
  return ls === s && la === a && lw >= from && lw <= to;
}

function stepWord(root: HTMLElement, location: string, dir: 1 | -1): string | null {
  const all = Array.from(root.querySelectorAll<HTMLElement>(".w"));
  const locs: string[] = [];
  for (const el of all) {
    locs.push(el.dataset.w!);
    if (el.dataset.w2) locs.push(el.dataset.w2);
  }
  const unique = [...new Set(locs)];
  const i = unique.indexOf(location);
  const next = unique[i + dir];
  return next ?? null;
}
