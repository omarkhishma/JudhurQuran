"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { listGraphs } from "@/lib/graph/persist";
import { useSaved } from "@/lib/store/saved";
import { del, get, keys } from "idb-keyval";

type Tab = "bookmarks" | "notes" | "history";

export function SavedView() {
  const t = useTranslations("saved");
  const locale = useLocale();
  const client = useIsClient();
  const { bookmarks, notes, history, clearAll } = useSaved();
  const [tab, setTab] = useState<Tab>("bookmarks");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const date = (n: number) => new Date(n).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB");

  function hrefFor(kind: string, key: string): string {
    if (kind === "verse") return `/quran/${key.replace(":", "/")}`;
    if (kind === "word") return `/word/${key}`;
    return `/roots/${encodeURIComponent(key)}`;
  }

  async function exportAll() {
    const graphs = await Promise.all((await listGraphs()).map((g) => get(`judhur-graph:${g.id}`)));
    const local: Record<string, unknown> = {};
    for (const k of ["judhur-saved", "judhur-prefs", "judhur-progress", "judhur-panel-layers", "judhur-theme"]) {
      try {
        local[k] = JSON.parse(localStorage.getItem(k) ?? "null");
      } catch {
        local[k] = localStorage.getItem(k);
      }
    }
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), local, graphs }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "judhur-my-data.json";
    a.click();
  }

  async function deleteAll() {
    if (!confirm) return setConfirm(true);
    clearAll();
    for (const k of ["judhur-saved", "judhur-prefs", "judhur-progress", "judhur-panel-layers"]) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }
    for (const k of await keys()) if (String(k).startsWith("judhur-")) await del(k);
    setConfirm(false);
    setDone(true);
  }

  const noteList = Object.values(notes).sort((a, b) => b.at - a.at);
  return (
    <div className="mx-auto max-w-[900px] px-4 py-10">
      <h1 className="text-[28px] font-semibold">{t("title")}</h1>
      <p className="mt-1 max-w-[70ch] text-t2">{t("lead")}</p>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="seg-group" role="tablist" aria-label={t("title")}>
          {(["bookmarks", "notes", "history"] as const).map((k) => (
            <button
              key={k}
              id={`saved-tab-${k}`}
              type="button"
              role="tab"
              aria-selected={tab === k}
              aria-controls="saved-panel"
              className="seg"
              onClick={() => setTab(k)}
            >
              {t(k === "bookmarks" ? "tabBookmarks" : k === "notes" ? "tabNotes" : "tabHistory")}
            </button>
          ))}
        </div>
        <Link href="/graph" className="btn">{t("tabMaps")}</Link>
      </div>
      <div className="mt-4" role="tabpanel" id="saved-panel" aria-labelledby={`saved-tab-${tab}`}>
        {client && tab === "bookmarks" && (
          bookmarks.length ? (
            <ul className="space-y-2">
              {bookmarks.map((b) => (
                <li key={`${b.kind}:${b.key}`}>
                  <Link href={hrefFor(b.kind, b.key)} className="card flex items-center justify-between p-4 hover:border-ring">
                    <span className="ar-classical text-[18px]" lang="ar">{b.label}</span>
                    <span className="text-[12px] text-t3">{t(b.kind === "verse" ? "kindVerse" : b.kind === "word" ? "kindWord" : "kindRoot")} · {date(b.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-card p-5 text-t2">{t("emptyBookmarks")}</p>
          )
        )}
        {client && tab === "notes" && (
          noteList.length ? (
            <ul className="space-y-2">
              {noteList.map((n) => (
                <li key={n.verse} className="card p-4">
                  <Link href={`/quran/${n.verse.replace(":", "/")}`} className="mono text-[12.5px] text-word" dir="ltr">{n.verse}</Link>
                  <p className="mt-1 whitespace-pre-wrap text-[14.5px]">{n.text}</p>
                  <p className="mt-1 text-[11.5px] text-t3">{date(n.at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-card p-5 text-t2">{t("emptyNotes")}</p>
          )
        )}
        {client && tab === "history" && (
          history.length ? (
            <ul className="flex flex-wrap gap-2">
              {history.map((h) => (
                <li key={h.location}>
                  <Link href={`/word/${h.location}`} className="flex min-h-[44px] items-center gap-2 rounded-xl border border-line bg-card px-3 hover:border-ring">
                    <span className="ar-classical text-[18px]" lang="ar">{h.label}</span>
                    {h.root && <span className="ar-classical text-[14px] text-root" lang="ar">{h.root.split("").join(" ")}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-card p-5 text-t2">{t("emptyHistory")}</p>
          )
        )}
      </div>
      <section className="card mt-10 p-5" aria-labelledby="data-controls">
        <h2 id="data-controls" className="mb-3 font-semibold">{t("dataControls")}</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn min-h-[40px]" onClick={() => void exportAll()}>{t("export")}</button>
          <button type="button" className={"btn min-h-[40px] " + (confirm ? "border-bad text-bad" : "")} onClick={() => void deleteAll()}>
            {confirm ? t("deleteConfirm") : t("delete")}
          </button>
        </div>
        {done && <p className="mt-2 text-[13px] text-good" role="status">{t("deleted")}</p>}
      </section>
    </div>
  );
}
