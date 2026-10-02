"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { cnt, cnt2 } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { useReader } from "@/lib/reader/store";
import { useSaved } from "@/lib/store/saved";

export type DrawerTool = "roots" | "related" | "note" | "graph";
type VersePayload = { key: string; words: { location: string; root: string | null; lemma: string | null; lemma_slug?: string | null; text_uthmani: string }[] };
type Related = { data: { score: number; roots: string[]; verse: { key: string; surah: number; ayah: number; text_qpc: string; name_ar: string } }[] };

/** A verse's drawer (RDR-151…159, adapted per RDR-555): the roots it is built on, verses sharing them,
 * a note anchored to it, and the graph it would seed. One drawer open per verse; Esc closes it. */
export function VerseDrawer({ verseKey, tool, onClose }: { verseKey: string; tool: DrawerTool; onClose: () => void }) {
  const t = useTranslations("rd");
  return (
    <div className="drawer" role="region" aria-label={t(`tool_${tool}`)}>
      <div className="flex items-center">
        <p className="label-caps">{t(`drawer_${tool}`)}</p>
        <span className="flex-1" />
        <button type="button" className="text-[11.5px] text-t3 hover:text-t1" onClick={onClose}>{t("close")}</button>
      </div>
      {tool === "roots" && <RootsDrawer verseKey={verseKey} />}
      {tool === "related" && <RelatedDrawer verseKey={verseKey} />}
      {tool === "note" && <NoteDrawer verseKey={verseKey} />}
      {tool === "graph" && <GraphDrawer verseKey={verseKey} />}
    </div>
  );
}

function useVerse(key: string) {
  return useQuery({ queryKey: ["verse", key], queryFn: () => getJSON<VersePayload>(`/verses/${key}`) });
}

export function RootsDrawer({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const v = useVerse(verseKey);
  const focusRoot = useReader((s) => s.focusRoot);
  const setFocusRoot = useReader((s) => s.setFocusRoot);
  const counts = new Map<string, number>();
  for (const w of v.data?.words ?? []) if (w.root) counts.set(w.root, (counts.get(w.root) ?? 0) + 1);
  const roots = [...counts.entries()];
  if (v.data && roots.length === 0) return <p className="text-[12.5px] text-t3">{t("noRootsInVerse")}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {roots.map(([k, n]) => (
        <li key={k}>
          <button type="button" className={"rail-root" + (focusRoot === k ? " is-on" : "")} aria-pressed={focusRoot === k} onClick={() => setFocusRoot(focusRoot === k ? null : k)} title={t("highlightRootTitle", { root: k })}>
            <span className="ar-classical min-w-[72px] text-[19px] tracking-[.06em] text-root" lang="ar">{k.split("").join(" ")}</span>
            <span className="flex-1" />
            <span className="mono text-[11px] text-t3">{t("timesHere", cnt(n, locale))}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RelatedDrawer({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const q = useQuery({ queryKey: ["related", verseKey], queryFn: () => getJSON<Related>(`/verses/${verseKey}/related?limit=4`) });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11.5px] text-t3">{t("relatedMethod")}</p>
      {(q.data?.data ?? []).map((r) => (
        <Link key={r.verse.key} href={`/quran/${r.verse.surah}/${r.verse.ayah}`} className="related-row">
          <span className="flex items-center gap-2 text-[11.5px] text-t3">
            <span className="mono" dir="ltr">{r.verse.key}</span>
            <span>{r.verse.name_ar}</span>
            <span className="flex-1" />
            <span className="ar-classical text-[13px] text-root" lang="ar">{r.roots.slice(0, 3).join(" · ")}</span>
          </span>
          <span className="quran line-clamp-2 text-[17px] leading-[2]" lang="ar" dir="rtl">{r.verse.text_qpc}</span>
        </Link>
      ))}
    </div>
  );
}

export function NoteDrawer({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const note = useSaved((s) => s.notes[verseKey]);
  const setNote = useSaved((s) => s.setNote);
  const showToast = useReader((s) => s.showToast);
  const [draft, setDraft] = useState(note?.text ?? "");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setNote(verseKey, draft);
        showToast(draft.trim() ? t("noteSaved") : t("noteDeleted"));
      }}
    >
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="field" placeholder={t("notePlaceholder")} aria-label={t("tool_note")} dir="auto" />
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] text-t3">{t("notePrivate", { ref: verseKey })}</span>
        <span className="flex-1" />
        <button type="submit" className="btn btn-primary" disabled={!draft.trim() && !note}>{t("saveNote")}</button>
      </div>
    </form>
  );
}

function GraphDrawer({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const v = useVerse(verseKey);
  const words = (v.data?.words ?? []).filter((w) => w.root);
  const roots = [...new Set(words.map((w) => w.root!))];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-t2">{t("graphPreview", { ...cnt(roots.length, locale), ...cnt2(words.length, locale) })}</p>
      <div className="flex flex-wrap gap-1.5">
        {roots.map((r) => (
          <span key={r} className="chip"><span className="ar-classical text-[16px] text-root" lang="ar">{r.split("").join(" ")}</span></span>
        ))}
      </div>
      <Link href={`/graph?verse=${verseKey}`} className="btn self-start">{t("openInEditor")}</Link>
    </div>
  );
}
