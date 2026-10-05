"use client";

/**
 * A passage the reader selected in an article (B36): its words shown back to them, and what to do with it — put it on
 * a map, quote it on a card. Pressing it keeps the selection; × lets it go. The words named come from the article as
 * served, never typed. Its labels are the caller's, so the reader's and the map's own copy name it.
 */
export function PassageBar({ text, lang, action, onAction, clearLabel, onClear, note }: { text: string; lang: string; action: string; onAction: () => void; clearLabel: string; onClear: () => void; note?: string }) {
  return (
    <div className="passage-bar" role="group" aria-label={action}>
      <p className={"line-clamp-2 " + (lang === "en" ? "text-[12.5px]" : "ar-classical text-[14px] leading-[1.8]")} lang={lang === "en" ? "en" : "ar"} dir={lang === "en" ? "ltr" : "rtl"}>
        «{text}»
      </p>
      {note && <p className="text-[11px] leading-relaxed text-t3">{note}</p>}
      <div className="flex items-center gap-1.5">
        {/* pressed, the selection stays: the press is not a click into the page */}
        <button type="button" className="btn btn-primary text-[12px]" onMouseDown={(e) => e.preventDefault()} onClick={onAction}>
          {action}
        </button>
        <button type="button" className="field-remove" onMouseDown={(e) => e.preventDefault()} onClick={onClear} aria-label={clearLabel}>
          ×
        </button>
      </div>
    </div>
  );
}
