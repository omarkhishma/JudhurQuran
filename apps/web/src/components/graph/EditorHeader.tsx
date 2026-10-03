"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Link } from "@/i18n/navigation";
import { useCanvasTools, type CanvasTools } from "./GraphCanvas";

/**
 * The editor's own header (EDT-001, EDT-002, P8.1-A): the mark, the way back to My maps, the title, the save
 * status, the map's tools — Tidy · Fit, Undo · Redo, Import · Export · Image — the way back to the reader at the
 * word the map came from, sharing, the details, the theme and the list of keys. One 52 px row that scrolls
 * sideways when the window is narrow.
 */
export function EditorHeader({
  title,
  onTitle,
  status,
  reader,
  onImport,
  onShare,
  shareCopied,
  detailsOpen,
  onDetails,
  onHelp,
}: {
  title: string;
  onTitle: (title: string) => void;
  status: React.ReactNode;
  reader: { href: string; word: string | null };
  onImport: (file: File, tools: CanvasTools) => void;
  onShare: () => void;
  shareCopied: boolean;
  detailsOpen: boolean;
  onDetails: () => void;
  onHelp: () => void;
}) {
  const t = useTranslations("graph");
  const tools = useCanvasTools();
  const file = useRef<HTMLInputElement>(null);
  return (
    <header className="editor-header" aria-label={t("editorHeader")}>
      <span className="editor-mark" aria-hidden="true" />
      <Link href="/graph" className="btn shrink-0" title={t("backToMaps")}>
        <Icon name="chevronStart" />
        {t("editorTitle")}
      </Link>
      <TitleField title={title} onTitle={onTitle} />
      {status}
      <span className="flex-1" />
      <div className="seg-group shrink-0">
        <button type="button" className="seg" onClick={tools.tidy} aria-keyshortcuts="T" title={t("tidyHint")}>{t("tidy")}</button>
        <button type="button" className="seg" onClick={tools.fit} aria-keyshortcuts="F" title={t("fitHint")}>{t("fit")}</button>
      </div>
      <div className="seg-group shrink-0">
        <button type="button" className="seg" onClick={tools.undo} disabled={!tools.undoLabel} title={tools.undoLabel ? t("undoLabel", { label: tools.undoLabel }) : t("undo")} aria-keyshortcuts="Meta+Z">
          {t("undo")}
        </button>
        <button type="button" className="seg" onClick={tools.redo} disabled={!tools.redoLabel} title={tools.redoLabel ? t("redoLabel", { label: tools.redoLabel }) : t("redo")} aria-keyshortcuts="Meta+Shift+Z">
          {t("redo")}
        </button>
      </div>
      <div className="seg-group shrink-0">
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            // cleared, so the same file can be picked again (EDT-261)
            e.target.value = "";
            if (f) onImport(f, tools);
          }}
        />
        <button type="button" className="seg" onClick={() => file.current?.click()} title={t("importHint")}>{t("importJson")}</button>
        <button type="button" className="seg" onClick={tools.exportJson}>{t("exportJson")}</button>
        <button type="button" className="seg" onClick={tools.exportPng}>{t("exportPng")}</button>
      </div>
      <Link href={reader.href} className="btn shrink-0" title={reader.word ? t("readerAtTitle", { word: reader.word }) : t("readerTitle")}>
        <Icon name="book" />
        {reader.word ? t("readerAt", { word: reader.word }) : t("reader")}
      </Link>
      <button type="button" className="btn shrink-0" onClick={onShare} aria-live="polite">
        {shareCopied ? t("shareCopied") : t("share")}
      </button>
      <button type="button" className="btn shrink-0 max-md:hidden" aria-pressed={detailsOpen} onClick={onDetails} title={t("detailsToggle")}>
        {t("details")}
      </button>
      <ThemeToggle />
      <button type="button" className="btn icon-btn shrink-0" onClick={onHelp} aria-label={t("helpLabel")} title={t("helpTitle")} aria-keyshortcuts="?">
        ?
      </button>
    </header>
  );
}

/** The title, edited in place (EDT-013, HWF-40): Enter keeps it, Escape leaves it as it was, an empty title keeps
 * the old one; never an undo step. */
function TitleField({ title, onTitle }: { title: string; onTitle: (title: string) => void }) {
  const t = useTranslations("graph");
  const [draft, setDraft] = useState<string | null>(null);
  const done = (keep: boolean) => {
    if (keep && draft !== null && draft.trim() && draft.trim() !== title) onTitle(draft.trim());
    setDraft(null);
  };
  if (draft === null)
    return (
      <button type="button" className="editor-title" onClick={() => setDraft(title)} title={t("rename")}>
        <h1 className="truncate">{title}</h1>
      </button>
    );
  return (
    <input
      className="editor-title-input"
      aria-label={t("rename")}
      value={draft}
      autoFocus
      onFocus={(e) => e.target.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => done(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          done(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          done(false);
        }
      }}
    />
  );
}
