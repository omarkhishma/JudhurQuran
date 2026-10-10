"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { useBreakpoint } from "@/lib/reader/media";
import { usePersonal, usePrefs, useReader } from "@/lib/reader/store";
import { ReaderHeader } from "./ReaderHeader";
import { Rail } from "./Rail";
import { Panel } from "./Panel";
import { AskView } from "./AskView";
import { Overlays } from "./Overlays";

export type ChapterInfo = {
  text: string; // text slug ("quran")
  number: number;
  nameAr: string;
  nameTranslit: string;
  place: "meccan" | "medinan";
  verseCount: number;
  juz: number;
};

/**
 * Reader v5 (design 03): bespoke header, rail, reading surface, docked panel — a bottom sheet on phones.
 * The reading surface itself is server-rendered (children) so the mushaf text is in the HTML.
 */
export function ReaderShell({ chapter, children, footer }: { chapter: ChapterInfo; children: React.ReactNode; footer?: React.ReactNode }) {
  const t = useTranslations("rd");
  const bp = useBreakpoint();
  const mode = useReader((s) => s.mode);
  const ask = useReader((s) => s.ask);
  const railOverlay = useReader((s) => s.railOverlay);
  const setRailOverlay = useReader((s) => s.setRailOverlay);
  const railOpen = usePrefs((s) => s.railOpen);
  const panelOpen = usePrefs((s) => s.panelOpen);
  const panelW = usePrefs((s) => s.panelW);
  const setPrefs = usePrefs((s) => s.set);
  const surface = useRef<HTMLDivElement>(null);

  // First visit (design 03 §3.1, fixed per RDR-516): Ask when there is no mode, word, verse or progress,
  // and the reader never visited before — an explicit flag, not a falsy chapter index.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const personal = usePersonal.getState();
    const mode = p.get("mode");
    if (mode === "ask") useReader.getState().setAsk(true, p.get("q") ?? "");
    else if (mode === "lookup") {
      useReader.getState().setMode("index");
      setPrefs({ panelOpen: true });
    } else if (mode === "about") {
      useReader.getState().setMode("surah");
      setPrefs({ panelOpen: true });
    } else if (mode === "review") useReader.getState().setReview(true);
    else if (!mode && !p.get("w") && !p.get("v") && !personal.visited && Object.keys(personal.progress).length === 0) {
      useReader.getState().setAsk(true);
    }
    personal.markVisited();
  }, [setPrefs]);

  const railDocked = bp === "wide" && railOpen;
  const railShown = bp === "wide" ? railOpen : railOverlay;
  const phone = bp === "phone";

  return (
    <div className="reader-v5" data-bp={bp} data-rail={railDocked ? "docked" : undefined} data-sheet={phone && panelOpen && mode !== "empty" && !ask ? "open" : undefined}>
      <ReaderHeader chapter={chapter} surfaceRef={surface} />
      <div className="reader-row">
        {railShown && (
          <>
            {!railDocked && <div className="reader-scrim" onClick={() => setRailOverlay(false)} aria-hidden="true" />}
            <Rail chapter={chapter} overlay={!railDocked} onNavigate={() => !railDocked && setRailOverlay(false)} />
          </>
        )}
        <div ref={surface} className="reader-surface" data-ask={ask || undefined}>
          {ask ? <AskView /> : children}
        </div>
        {!phone && panelOpen && !ask && <Panel chapter={chapter} docked width={panelW} />}
        {!phone && !panelOpen && !ask && (
          <button type="button" className="panel-strip" onClick={() => setPrefs({ panelOpen: true })} title={t("dictionaryTitle")}>
            <Icon name="chevronStart" size={14} />
            <span className="panel-strip-label">{t("dictionary")}</span>
          </button>
        )}
        {phone && panelOpen && <Panel chapter={chapter} docked={false} width={0} />}
      </div>
      {footer}
      <Overlays chapter={chapter} />
    </div>
  );
}
