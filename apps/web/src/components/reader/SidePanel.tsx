"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useReader } from "@/lib/store/reader";
import { WordPanel } from "./WordPanel";
import { VersePanel } from "./VersePanel";

/**
 * The panel docks beside the text on wide screens and becomes a bottom sheet on phones
 * (half height on open; drag the grabber up for full height, down to close).
 */
export function SidePanel({ surahName }: { surahName: string }) {
  const t = useTranslations("panel");
  const panel = useReader((s) => s.panel);
  const close = useReader((s) => s.close);
  const openWord = useReader((s) => s.openWord);
  const panelId = panel ? (panel.kind === "word" ? `w${panel.location}` : `v${panel.key}`) : "";
  const [fullFor, setFullFor] = useState<string | null>(null);
  const full = fullFor === panelId;
  const setFull = (v: boolean) => setFullFor(v ? panelId : null);
  const drag = useRef<{ y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [panel]);

  function navigate(dir: 1 | -1) {
    if (panel?.kind !== "word") return;
    const all = Array.from(document.querySelectorAll<HTMLElement>(".reader-text .w"));
    const locs: string[] = [];
    for (const el of all) {
      locs.push(el.dataset.w!);
      if (el.dataset.w2) locs.push(el.dataset.w2);
    }
    const unique = [...new Set(locs)];
    const next = unique[unique.indexOf(panel.location) + dir];
    if (next) openWord(next);
  }

  if (!panel) return null;
  const label = panel.kind === "word" ? t("wordPanel") : t("versePanel");
  return (
    <>
      <div className="fixed inset-0 z-30 bg-[rgba(10,10,16,.18)] lg:hidden" onClick={close} aria-hidden="true" />
      <aside
        aria-label={label}
        className={
          "side-panel fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[18px] border border-line-2 bg-card shadow-open " +
          "lg:sticky lg:top-[52px] lg:z-0 lg:h-[calc(100dvh-52px)] lg:rounded-none lg:border-0 lg:border-s lg:shadow-none " +
          (full ? "h-[92dvh]" : "h-[58dvh]")
        }
      >
        <div
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center lg:hidden"
          onPointerDown={(e) => {
            drag.current = { y: e.clientY };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            if (!drag.current) return;
            const dy = e.clientY - drag.current.y;
            drag.current = null;
            if (dy < -40) setFull(true);
            else if (dy > 60) {
              if (full) setFull(false);
              else close();
            }
          }}
          aria-hidden="true"
        >
          <span className="h-1 w-10 rounded-full bg-line-2" />
        </div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {panel.kind === "word" ? (
            <WordPanel location={panel.location} onNavigate={navigate} onClose={close} />
          ) : (
            <VersePanel verseKey={panel.key} surahName={surahName} onClose={close} />
          )}
        </div>
      </aside>
    </>
  );
}
