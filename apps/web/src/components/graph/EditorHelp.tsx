"use client";

import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";

/**
 * Keyboard and pointer (EDT-249…254): every key and gesture the editor answers to, in four groups — and only
 * those it answers to.
 */
const GROUPS = [
  { title: "helpCanvas", rows: [["helpKeyWheel", "helpPan"], ["helpKeyCmdWheel", "helpZoom"], ["helpKeyShiftWheel", "helpPanSide"], ["helpKeySpaceDrag", "helpPanMouse"], ["helpKeyShiftDrag", "helpMarquee"], ["helpKeyFit", "helpFitZoom"]] },
  { title: "helpCards", rows: [["helpKeyDouble", "helpFold"], ["helpKeyEnter", "helpFoldSel"], ["helpKeyExtract", "helpExtract"], ["helpKeyDuplicate", "helpDuplicate"], ["helpKeyGroup", "helpGroup"], ["helpKeyDelete", "helpDelete"], ["helpKeySelectAll", "helpSelectAll"], ["helpKeyEscape", "helpEscape"]] },
  { title: "helpMove", rows: [["helpKeyLeftRight", "helpChildParent"], ["helpKeyUpDown", "helpSiblings"], ["helpKeyAltArrows", "helpNudge"], ["helpKeyArrows", "helpPanKeys"], ["helpKeyRightClick", "helpMenu"]] },
  { title: "helpLinks", rows: [["helpKeyDragDot", "helpLink"], ["helpKeyLinkTwo", "helpLinkTwo"], ["helpKeyClickWire", "helpWire"], ["helpKeyFindEnter", "helpFindNext"], ["helpKeyFindShift", "helpFindPrev"]] },
  { title: "helpMap", rows: [["helpKeyTidy", "helpTidy"], ["helpKeyUndo", "helpUndo"], ["helpKeyHelp", "helpOpen"], ["helpKeyDrop", "helpDropCard"]] },
] as const;

export function EditorHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("graph");
  return (
    <Dialog open={open} onClose={onClose} label={t("helpHeading")} width={560}>
      <div className="editor-help flex flex-col gap-3 p-4">
        <div className="flex items-center">
          <h2 className="text-[15px] font-semibold">{t("helpHeading")}</h2>
          <span className="flex-1" />
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t("helpClose")}>✕</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="label-caps mb-1.5">{t(g.title)}</h3>
              <dl className="flex flex-col gap-1.5">
                {g.rows.map(([key, what]) => (
                  <div key={key} className="flex items-start justify-between gap-3 text-[12.5px]">
                    <dt>
                      {/* a gesture in words reads in the interface's type; a key in the monospace of keys */}
                      <kbd className={"kbd" + (/[\u0600-\u06ff]/.test(t(key)) ? " is-text" : "")} dir="auto">{t(key)}</kbd>
                    </dt>
                    <dd className="text-end text-t2">{t(what)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
