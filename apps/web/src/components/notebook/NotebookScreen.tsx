"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useDueCount } from "@/lib/review/due";
import { useStepViews } from "@/components/reader5/trailSteps";
import { ProposalForm } from "@/components/contrib/ProposalForm";
import { Dialog } from "@/components/ui/Dialog";
import { Segmented } from "@/components/ui/Segmented";
import { Link } from "@/i18n/navigation";
import { normalize } from "@/lib/arabic/normalize";
import { useIsClient } from "@/lib/client";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { foldLatin, type Mention, parseMentions } from "@/lib/notebook/mentions";
import { getJSON } from "@/lib/reader/api";
import { mergeSessions, type SavedTrail, usePersonal } from "@/lib/reader/store";
import { type NoteLinks, useNotebook, useNotebookReady, useNotebookUnreadable } from "@/lib/store/notebook";
import { useSaved } from "@/lib/store/saved";
import { useDebounced } from "@/lib/useDebounced";

type Group = "all" | "root" | "surah" | "tag";
/** One row of the notebook: a free note, a note on a verse, or a saved trail (NTB-35…38 reconciled). */
type Item = { kind: "note" | "verse" | "trail"; id: string; title: string; body: string; tags: string[]; created: number; updated: number; roots: string[]; verses: string[]; words?: string[]; verse?: string; trail?: SavedTrail };
type SurahRow = { number: number; name_ar: string; name_translit: string; verse_count: number };
type Resolved = { mention: Mention; href: string | null; label: string; kind: "verse" | "root" | "word" | "lexicon" | "none"; root?: string; verse?: string; slug?: string };

const surahOf = (key: string) => Number(key.split(":")[0]);
const download = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const NOTE_ID = /^[\w:.-]{1,60}$/;

/** The note named in the address's fragment (#note=…), if any. */
function noteFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const id = decodeURIComponent(new URLSearchParams(window.location.hash.slice(1)).get("note") ?? "");
  return NOTE_ID.test(id) ? id : null;
}

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** The Notebook's address for a tab and an open note: the note in the fragment, never in the query. */
export function noteAddress(tab: "notes" | "journal", note: string | null, path = typeof window === "undefined" ? "" : window.location.pathname): string {
  return `${path}${tab === "journal" ? "?tab=journal" : ""}${note && tab === "notes" ? `#note=${encodeURIComponent(note)}` : ""}`;
}

/**
 * The Notebook (06 §6.4, inventory NTB-01…54 with the Quran notes NTB-Q01…Q10): the reader's notes — free notes,
 * notes on a verse, saved trails — searched with Arabic folded, grouped into real sections by root, sūra or tag,
 * edited with tags and @-mentions that link verses, roots, words and lexicons; and the journal of their reading,
 * day by day, with no streak. Everything stays in this browser.
 */
export function NotebookScreen({ initialTab, initialNote }: { initialTab: "notes" | "journal"; initialNote: string | null }) {
  const t = useTranslations("notebook");
  const locale = useLocale();
  // the notes are read from IndexedDB a moment after the page: nothing is said about them before then
  const isClient = useIsClient();
  const ready = useNotebookReady();
  const client = isClient && ready;
  const unreadable = useNotebookUnreadable();
  const items = useItems();
  const [tab, setTab] = useState(initialTab);
  // the open note is in the address's fragment, which the browser never sends (audit 11 F9): a verse written on stays
  // in the browser even when the page is reloaded or the link followed (an older ?note= link is read once, then moved)
  // (a link followed inside the site sets the fragment as this page mounts, after its first render)
  const hashNote = useSyncExternalStore(subscribeHash, noteFromHash, () => null);
  const [selected, setSelected] = useState<string | null>(initialNote);
  const [seenHash, setSeenHash] = useState<string | null>(null);
  if (hashNote !== seenHash) {
    setSeenHash(hashNote);
    if (hashNote) setSelected(hashNote);
  }
  useEffect(() => {
    if (initialNote) window.history.replaceState(null, "", noteAddress(initialTab, initialNote));
  }, [initialTab, initialNote]);
  const create = useNotebook((s) => s.create);
  const current = client ? (items.find((x) => x.id === selected) ?? null) : null;

  function go(next: { tab?: "notes" | "journal"; note?: string | null }) {
    const tb = next.tab ?? tab;
    const nt = next.note === undefined ? selected : next.note;
    setTab(tb);
    setSelected(nt);
    // the address follows (Back and a shared link work) without asking the server: which note is open, and so
    // which verse the reader wrote on, stays in the browser (P5.6, F9)
    window.history.replaceState(null, "", noteAddress(tb, nt));
  }

  return (
    <div className="notebook-screen">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold">{t("title")}</h1>
        <span className="flex-1" />
        <Segmented label={t("tabs")} value={tab} onChange={(v) => go({ tab: v })} options={[{ value: "notes", label: t("tabNotes", { n: client ? formatNumber(items.length, locale) : "–" }) }, { value: "journal", label: t("tabJournal") }]} />
        <button type="button" className="btn btn-primary" onClick={() => go({ tab: "notes", note: create() })} disabled={unreadable}>{t("newNote")}</button>
      </div>
      <p className="text-[12px] text-t3">{t("private")}</p>
      {unreadable && (
        <p className="attention-note" role="alert">
          {t("unreadable")}
        </p>
      )}
      {tab === "notes" ? (
        <NotesTab items={client ? items : []} loaded={client} current={current} onSelect={(id) => go({ note: id })} />
      ) : (
        <JournalTab items={client ? items : []} />
      )}
    </div>
  );
}

/** Free notes, verse notes and saved trails as one list, newest edit first. */
function useItems(): Item[] {
  const notes = useNotebook((s) => s.notes);
  const verseNotes = useSaved((s) => s.notes);
  const trails = usePersonal((s) => s.savedTrails);
  return useMemo(() => {
    const out: Item[] = [
      ...notes.map((n) => ({ kind: "note" as const, id: n.id, title: n.title, body: n.body, tags: n.tags, created: n.created, updated: n.updated, roots: n.links.roots, verses: n.links.verses, words: n.links.words ?? [] })),
      ...Object.values(verseNotes).map((n) => ({ kind: "verse" as const, id: `v:${n.verse}`, title: "", body: n.text, tags: [], created: n.at, updated: n.at, roots: [], verses: [n.verse], verse: n.verse })),
      ...trails.map((tr) => ({
        kind: "trail" as const,
        id: `t:${tr.id}`,
        title: "",
        body: "",
        tags: [],
        created: tr.ts,
        updated: tr.ts,
        roots: [...new Set(tr.steps.filter((s) => s.kind === "root").map((s) => s.id))],
        verses: [...new Set(tr.steps.filter((s) => s.kind === "verse").map((s) => s.id))],
        trail: tr,
      })),
    ];
    return out.sort((a, b) => b.updated - a.updated);
  }, [notes, verseNotes, trails]);
}

function useSurahs() {
  return useQuery({ queryKey: ["surahs"], queryFn: () => getJSON<{ data: SurahRow[] }>("/surahs"), staleTime: Infinity });
}

function NotesTab({ items, loaded, current, onSelect }: { items: Item[]; loaded: boolean; current: Item | null; onSelect: (id: string | null) => void }) {
  const t = useTranslations("notebook");
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const surahs = useSurahs();
  const name = (n: number) => {
    const s = surahs.data?.data.find((x) => x.number === n);
    return s ? (locale === "ar" ? s.name_ar : s.name_translit) : String(n);
  };
  // Arabic folded on both sides: vowels, hamza seats and tāʾ marbūṭa do not hide a note (NTB-06, NTB-Q05)
  const nq = normalize(q.trim()).toLowerCase();
  const shown = nq ? items.filter((x) => normalize(`${x.title} ${x.body} ${x.tags.join(" ")}`).toLowerCase().includes(nq)) : items;
  // real sections (NTB-Q06): a note under each root, sūra or tag it carries
  const sections: { key: string; label: string; items: Item[] }[] = (() => {
    if (group === "all") return [{ key: "all", label: "", items: shown }];
    const by = new Map<string, Item[]>();
    const none = group === "root" ? t("noRoot") : group === "surah" ? t("noSurah") : t("noTag");
    for (const x of shown) {
      const keys = group === "root" ? x.roots : group === "surah" ? [...new Set(x.verses.map(surahOf))].map(String) : x.tags;
      for (const k of keys.length ? keys : [""]) by.set(k, [...(by.get(k) ?? []), x]);
    }
    return [...by.entries()]
      .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : group === "surah" ? Number(a) - Number(b) : a.localeCompare(b, "ar")))
      .map(([k, v]) => ({ key: k || "_", label: !k ? none : group === "root" ? k.split("").join(" ") : group === "surah" ? `${formatNumber(Number(k), locale)}. ${name(Number(k))}` : k, items: v }));
  })();

  return (
    <div className={"notebook-notes" + (current ? " has-current" : "")}>
      <div className="notebook-list">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="field" placeholder={t("search")} aria-label={t("searchLabel")} dir="auto" />
        <Segmented label={t("group")} value={group} onChange={setGroup} options={[{ value: "all", label: t("groupAll") }, { value: "root", label: t("groupRoot") }, { value: "surah", label: t("groupSurah") }, { value: "tag", label: t("groupTag") }]} />
        {/* "no notes yet" only once the notes are read: never while loading, never when they could not be read */}
        {items.length === 0 ? (
          loaded && (
            <p className="text-[13px] leading-relaxed text-t3">
              {t("empty")} <Link href="/read" className="underline">{t("emptyReader")}</Link>
            </p>
          )
        ) : shown.length === 0 ? (
          <p className="text-[13px] text-t3" role="status">{t("noMatches", { q })}</p>
        ) : (
          sections.map((s) => (
            <section key={s.key} aria-label={s.label || undefined}>
              {s.label && <h3 className={"notebook-section" + (group === "root" && s.key !== "_" ? " ar-classical text-root" : "")} lang={group === "root" ? "ar" : undefined}>{s.label}</h3>}
              <ul className="flex flex-col">
                {s.items.map((x) => (
                  <li key={`${s.key}-${x.id}`}>
                    <NoteRow x={x} on={current?.id === x.id} onSelect={() => onSelect(x.id)} name={name} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
        {items.length > 0 && <ExportAll items={items} />}
      </div>
      <div className="notebook-editor">
        {current ? (
          <>
            <button type="button" className="btn notebook-back" onClick={() => onSelect(null)}>{t("back")}</button>
            {current.kind === "note" ? <NoteEditor key={current.id} x={current} onDeleted={() => onSelect(null)} /> : current.kind === "verse" ? <VerseNoteEditor key={current.id} x={current} name={name} onDeleted={() => onSelect(null)} /> : <TrailView key={current.id} x={current} onDeleted={() => onSelect(null)} />}
          </>
        ) : (
          <p className="text-[13.5px] text-t3">{t("select")}</p>
        )}
      </div>
    </div>
  );
}

function NoteRow({ x, on, onSelect, name }: { x: Item; on: boolean; onSelect: () => void; name: (n: number) => string }) {
  const t = useTranslations("notebook");
  const locale = useLocale();
  const title = x.kind === "trail" ? t("kindTrail") : x.title || x.body.split("\n")[0].slice(0, 60) || t("untitled");
  const sub = [
    x.kind === "verse" && x.verse ? `${name(surahOf(x.verse))}: ${formatNumber(Number(x.verse.split(":")[1]), locale)}` : null,
    x.roots.length ? x.roots.map((r) => r.split("").join(" ")).join("، ") : null,
    x.tags.length ? x.tags.join("، ") : null,
    new Date(x.updated).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short" }),
  ].filter(Boolean);
  return (
    <button type="button" className={"notebook-row" + (on ? " is-on" : "")} aria-current={on ? "true" : undefined} onClick={onSelect}>
      <span className="truncate text-[13px] font-medium" dir="auto">{title}</span>
      <span className="truncate text-[11.5px] text-t3" dir="auto">{[x.kind === "verse" ? t("kindVerse") : null, ...sub].filter(Boolean).join(" • ")}</span>
    </button>
  );
}

/** A free note: title, tags, body with @-mentions resolved into links (NTB-19…34). */
function NoteEditor({ x, onDeleted }: { x: Item; onDeleted: () => void }) {
  const t = useTranslations("notebook");
  const locale = useLocale();
  const update = useNotebook((s) => s.update);
  const remove = useNotebook((s) => s.remove);
  // the reader's tags so far, offered as they type a new one (NTB-21)
  const notes = useNotebook((s) => s.notes);
  const known = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].filter((tg) => !x.tags.includes(tg)).sort((a, b) => a.localeCompare(b, locale)), [notes, x.tags, locale]);
  const [tag, setTag] = useState("");
  const [confirm, setConfirm] = useState(false);
  const resolved = useResolved(x.body);
  // the links the mentions resolve to are kept on the note, so grouping by root and sūra needs no lookup
  const links: NoteLinks = useMemo(
    () => ({
      roots: [...new Set(resolved.flatMap((r) => (r.root ? [r.root] : [])))],
      verses: [...new Set(resolved.flatMap((r) => (r.verse ? [r.verse] : [])))],
      words: [...new Set(resolved.flatMap((r) => (r.slug ? [r.slug] : [])))],
    }),
    [resolved],
  );
  useEffect(() => {
    if (JSON.stringify(links) !== JSON.stringify({ roots: x.roots, verses: x.verses, words: x.words ?? [] })) update(x.id, { links });
  }, [links, x.id, x.roots, x.verses, x.words, update]);
  const fmt = (n: number) => new Date(n).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <article className="flex flex-col gap-3">
      <input value={x.title} onChange={(e) => update(x.id, { title: e.target.value })} className="notebook-title" placeholder={t("titlePlaceholder")} aria-label={t("titleLabel")} dir="auto" data-autofocus />
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-t3">
        <span>{t("meta", { date: fmt(x.created) })}</span>
        {x.updated !== x.created && <span>• {t("updated", { date: fmt(x.updated) })}</span>}
        {x.tags.map((tg) => (
          <span key={tg} className="tag-pill">
            {tg}
            <button type="button" aria-label={t("removeTag", { tag: tg })} onClick={() => update(x.id, { tags: x.tags.filter((y) => y !== tg) })}>×</button>
          </span>
        ))}
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const v = tag.trim();
            // no duplicates, no empty tags (NTB-21)
            if (v && !x.tags.includes(v)) update(x.id, { tags: [...x.tags, v] });
            setTag("");
          }}
          className="tag-input"
          placeholder={t("tagPlaceholder")}
          aria-label={t("addTag")}
          list={known.length ? "notebook-tags" : undefined}
          dir="auto"
        />
        {known.length > 0 && (
          <datalist id="notebook-tags">
            {known.map((tg) => (
              <option key={tg} value={tg} />
            ))}
          </datalist>
        )}
      </div>
      <textarea value={x.body} onChange={(e) => update(x.id, { body: e.target.value })} rows={10} className="field notebook-body" placeholder={t("bodyPlaceholder")} aria-label={t("bodyLabel")} dir="auto" />
      <LinkedChips resolved={resolved} />
      <ProposeFromNote words={resolved.filter((r) => r.kind === "word" && r.slug)} body={x.body} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => download(`${(x.title || "note").replace(/[\\/:*?"<>|]/g, "-")}.md`, toMarkdown(x, locale), "text/markdown")}>{t("export")}</button>
        <span className="flex-1" />
        {confirm ? (
          <>
            <span className="self-center text-[12.5px] text-t2">{t("deleteConfirm")}</span>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>{t("cancel")}</button>
            <button type="button" className="btn btn-danger" onClick={() => { remove(x.id); onDeleted(); }}>{t("delete")}</button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirm(true)}>{t("delete")}</button>
        )}
      </div>
    </article>
  );
}

/** A note written on a verse in the reader: the verse verbatim, in full on request (NTB-Q03), and the note,
 * edited where the reader keeps it. */
function VerseNoteEditor({ x, name, onDeleted }: { x: Item; name: (n: number) => string; onDeleted: () => void }) {
  const t = useTranslations("notebook");
  const locale = useLocale();
  const setNote = useSaved((s) => s.setNote);
  const [full, setFull] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState(x.body);
  const key = x.verse!;
  const v = useQuery({ queryKey: ["verse-text", key], queryFn: () => getJSON<{ tokens: { text: string }[] }>(`/verses/${key}`), staleTime: Infinity });
  const tokens = v.data?.tokens.map((tk) => tk.text) ?? [];
  const ref = `${name(surahOf(key))}: ${formatNumber(Number(key.split(":")[1]), locale)}`;
  return (
    <article className="flex flex-col gap-3">
      <figure className="notebook-anchor">
        <figcaption className="text-[12px] text-t3">{t("anchored", { ref })}</figcaption>
        <p className="quran text-[20px] leading-[2]" lang="ar" dir="rtl">{full || tokens.length <= 12 ? tokens.join(" ") : `${tokens.slice(0, 12).join(" ")} …`}</p>
        <div className="flex flex-wrap gap-3 text-[12px]">
          {tokens.length > 12 && <button type="button" className="underline-offset-2 hover:underline" onClick={() => setFull(!full)}>{full ? t("hideVerse") : t("showVerse")}</button>}
          <Link href={`/quran/${surahOf(key)}/${key.split(":")[1]}`} className="underline-offset-2 hover:underline">{t("openVerse")}</Link>
        </div>
      </figure>
      {/* an emptied verse note is deleted by the store, so the text is saved when it has some — and emptying it
          asks whether to delete the note or bring its text back, rather than keeping the old text unsaid (NTB-35) */}
      <textarea value={draft} onChange={(e) => { setDraft(e.target.value); if (e.target.value.trim()) setNote(key, e.target.value); }} rows={8} className="field notebook-body" aria-label={t("bodyLabel")} dir="auto" />
      {!draft.trim() && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-t2" role="status">
          <span>{t("emptied")}</span>
          <button type="button" className="btn btn-danger" onClick={() => { setNote(key, ""); onDeleted(); }}>{t("delete")}</button>
          <button type="button" className="btn" onClick={() => setDraft(x.body)}>{t("restoreText")}</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => download(`note-${key.replace(":", "-")}.md`, toMarkdown({ ...x, body: draft, title: ref }, locale), "text/markdown")}>{t("export")}</button>
        <span className="flex-1" />
        {confirm ? (
          <>
            <span className="self-center text-[12.5px] text-t2">{t("deleteConfirm")}</span>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>{t("cancel")}</button>
            <button type="button" className="btn btn-danger" onClick={() => { setNote(key, ""); onDeleted(); }}>{t("delete")}</button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirm(true)}>{t("delete")}</button>
        )}
      </div>
    </article>
  );
}

function TrailView({ x, onDeleted }: { x: Item; onDeleted: () => void }) {
  const t = useTranslations("notebook");
  const locale = useLocale();
  const del = usePersonal((s) => s.deleteTrail);
  const [confirm, setConfirm] = useState(false);
  const views = useStepViews(x.trail!.steps);
  const href = (s: (typeof views)[number]) => (s.step.kind === "word" ? `/read?w=${encodeURIComponent(s.step.id)}` : s.step.kind === "verse" ? `/quran/${s.step.id.replace(":", "/")}` : `/roots/${encodeURIComponent(s.step.id)}`);
  return (
    <article className="flex flex-col gap-3">
      <h2 className="text-[18px] font-semibold" dir="auto">{t("trailTitle", { steps: views.slice(0, 3).map((v) => v.label).join(" › ") + (views.length > 3 ? " …" : "") })}</h2>
      <p className="text-[12px] text-t3">{t("trailMeta", { ...cnt(views.length, locale), date: new Date(x.created).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) })}</p>
      <ol className="flex flex-col gap-1.5">
        {views.map((v, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="mono w-6 text-[11px] text-t3">{formatNumber(i + 1, locale)}</span>
            <span className="dot" style={{ background: v.color }} aria-hidden="true" />
            <Link href={href(v)} className={v.step.kind === "verse" ? "mono text-[13px]" : "ar-classical text-[18px]"} lang={v.step.kind === "verse" ? undefined : "ar"}>
              {v.step.kind === "verse" ? verseRef(v.label, locale) : v.label}
            </Link>
            {v.sub && <span className="text-[12px] text-t3" dir="ltr">{v.sub}</span>}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap justify-end gap-2">
        {confirm ? (
          <>
            <span className="self-center text-[12.5px] text-t2">{t("deleteConfirm")}</span>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>{t("cancel")}</button>
            <button type="button" className="btn btn-danger" onClick={() => { del(x.trail!.id); onDeleted(); }}>{t("delete")}</button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirm(true)}>{t("delete")}</button>
        )}
      </div>
    </article>
  );
}

/** The mentions of a body, each resolved against the data: a verse checked against its sūra's length, a root
 * and a word through search, a lexicon by its Arabic or English name (NTB-28, Q04). */
function useResolved(body: string): Resolved[] {
  const locale = useLocale();
  const db = useDebounced(body, 400);
  const mentions = useMemo(() => parseMentions(db), [db]);
  const surahs = useSurahs();
  const lexica = useQuery({ queryKey: ["lexicon-works"], queryFn: () => getJSON<{ data: { id: string; title_ar: string; title_en: string }[] }>("/lexicon/works"), staleTime: Infinity, enabled: mentions.some((m) => m.kind === "word") });
  const searches = useQueries({
    queries: mentions.map((m) => ({
      queryKey: ["note-mention", m.kind === "verse" ? "" : m.query],
      // a private note's words go in a body, never a URL, a log line or a cache (NTB-28)
      queryFn: async () => {
        const r = await fetch("/api/v1/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: m.kind === "verse" ? "" : m.query, limit: 5 }) });
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as { detected: { kind: string }; results: { roots: { key: string; spaced: string }[]; lemmas: { slug?: string; ar: string; root: string | null }[] } };
      },
      enabled: m.kind !== "verse",
      staleTime: Infinity,
    })),
  });
  return mentions.map((m, i): Resolved => {
    if (m.kind === "verse") {
      const s = surahs.data?.data.find((x) => x.number === m.surah);
      if (!s || m.ayah < 1 || m.ayah > s.verse_count) return { mention: m, href: null, label: m.raw, kind: "none" };
      const to = m.to && m.to <= s.verse_count ? m.to : null;
      const nm = locale === "ar" ? s.name_ar : s.name_translit;
      return { mention: m, href: `/quran/${m.surah}/${m.ayah}`, label: `${nm}: ${formatNumber(m.ayah, locale)}${to ? `–${formatNumber(to, locale)}` : ""}`, kind: "verse", verse: `${m.surah}:${m.ayah}` };
    }
    const d = searches[i]?.data;
    if (m.kind === "word") {
      const fq = foldLatin(m.query);
      const nq = normalize(m.query);
      const lex = lexica.data?.data.find((w) => (nq.length >= 3 && normalize(w.title_ar).includes(nq)) || (fq.length >= 3 && foldLatin(w.title_en).includes(fq)));
      if (lex) return { mention: m, href: "/sources", label: locale === "ar" ? lex.title_ar : lex.title_en, kind: "lexicon" };
    }
    if (d?.detected.kind === "root" || m.kind === "root") {
      const r = d?.results.roots[0];
      return r ? { mention: m, href: `/concordance?root=${encodeURIComponent(r.key)}`, label: r.spaced, kind: "root", root: r.key } : { mention: m, href: null, label: m.raw, kind: "none" };
    }
    const w = d?.results.lemmas[0];
    if (w?.slug) return { mention: m, href: `/read?w=${encodeURIComponent(w.slug)}`, label: w.ar, kind: "word", root: w.root ?? undefined, slug: w.slug };
    return { mention: m, href: null, label: m.raw, kind: d ? "none" : "word" };
  });
}

/**
 * Propose from a note (NTB-22, 23, Q07): a word the note mentions, a proposal form prefilled with the note — a new
 * sense, an error report or an attestation — that the reader edits and sends themselves; a private note is never
 * sent by itself. With no word mentioned, it says how to name one.
 */
function ProposeFromNote({ words, body }: { words: Resolved[]; body: string }) {
  const t = useTranslations("notebook");
  const tc = useTranslations("contrib");
  const [word, setWord] = useState<Resolved | null>(null);
  return (
    <section className="flex flex-col gap-1.5" aria-label={t("propose")}>
      <p className="label-caps">{t("propose")}</p>
      {words.length === 0 ? (
        <p className="text-[12.5px] text-t3">{t("proposeNeedsWord")}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {words.slice(0, 6).map((w) => (
            <button key={w.slug} type="button" className="btn min-h-[40px]" onClick={() => setWord(w)}>
              {t("proposeOn")} <span className="ar-classical text-[16px]" lang="ar">{w.label}</span>
            </button>
          ))}
        </div>
      )}
      {word?.slug && (
        <Dialog open onClose={() => setWord(null)} label={tc("dialogLabel")} width={480}>
          <ProposalForm target={{ kind: "sense", slug: word.slug, label: word.label, current: "" }} kinds={["sense", "error", "attest"]} initialText={body} onClose={() => setWord(null)} />
        </Dialog>
      )}
    </section>
  );
}

function LinkedChips({ resolved }: { resolved: Resolved[] }) {
  const t = useTranslations("notebook");
  const colour = { verse: "var(--c-sentence)", root: "var(--c-root)", word: "var(--c-word)", lexicon: "var(--c-desc)", none: "var(--line-2)" } as const;
  return (
    <section aria-label={t("linked")} className="flex flex-col gap-1.5">
      <p className="label-caps">{t("linked")}</p>
      {resolved.length === 0 ? (
        <p className="text-[12.5px] text-t3">{t("linkedEmpty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {resolved.map((r) => (
            <li key={`${r.mention.kind}:${r.mention.raw}`}>
              {r.href ? (
                <Link href={r.href} prefetch={false} className="chip min-h-[32px] max-[899px]:min-h-[40px]" data-kind={r.kind}>
                  <span className="dot" style={{ background: colour[r.kind] }} aria-hidden="true" />
                  <span className={r.kind === "root" || r.kind === "word" ? "ar-classical text-[16px]" : ""} dir="auto">{r.label}</span>
                </Link>
              ) : (
                <span className="chip min-h-[32px] text-t3 max-[899px]:min-h-[40px]" data-kind="none">{r.kind === "none" ? t("unresolved", { raw: r.mention.raw }) : r.label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function toMarkdown(x: Item, locale: string): string {
  const date = new Date(x.created).toISOString().slice(0, 10);
  const lines = [`# ${x.title || (locale === "ar" ? "ملاحظة" : "Note")}`, "", x.body.trim(), ""];
  if (x.tags.length) lines.push(`tags: ${x.tags.join(", ")}`);
  if (x.verses.length) lines.push(`verses: ${x.verses.join(", ")}`);
  if (x.roots.length) lines.push(`roots: ${x.roots.join(", ")}`);
  lines.push(`created: ${date}`);
  return lines.join("\n") + "\n";
}

/** Every note as Markdown and as JSON, from here as well as from Saved (NTB-Q10). */
function ExportAll({ items }: { items: Item[] }) {
  const t = useTranslations("notebook");
  const locale = useLocale();
  return (
    <button
      type="button"
      className="btn mt-2 self-start"
      onClick={() => {
        const notes = items.filter((x) => x.kind !== "trail");
        download(`jadhr-notes-${new Date().toISOString().slice(0, 10)}.md`, notes.map((x) => toMarkdown(x, locale)).join("\n---\n\n"), "text/markdown");
      }}
    >
      {t("exportAll")}
    </button>
  );
}

/** The journal (NTB-39…53): this week's lookups day by day in the reader's own days, the sessions with the
 * roots met and notes written that day, all-time counts, what the scheduler says is due — and no streak. */
function JournalTab({ items }: { items: Item[] }) {
  const t = useTranslations("notebook");
  const locale = useLocale();
  const client = useIsClient();
  const all = usePersonal((s) => s.sessions);
  // a day read on two devices is one day in the journal (P6: the journal syncs when the reader turns that on)
  const sessions = useMemo(() => mergeSessions(all), [all]);
  const states = usePersonal((s) => s.wordStates);
  const starred = useSaved((s) => s.bookmarks.length);
  const due = useDueCount();
  const [today] = useState(() => new Date());
  // the reader's local days, as the reader records them (store.ts today(): en-CA in the local zone, NTB-52 fixed)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return { key: d.toLocaleDateString("en-CA"), date: d };
  });
  const per = (day: string) => sessions.filter((s) => s.day === day).reduce((a, s) => a + s.lookups, 0);
  const week = days.map((d) => ({ ...d, n: per(d.key) }));
  const max = Math.max(1, ...week.map((d) => d.n));
  const inWeek = sessions.filter((s) => days.some((d) => d.key === s.day));
  const rootsMet = usePersonal((s) => s.rootsMet);
  // all time: every root ever looked up, and those in sessions recorded before that was kept (NTB-45)
  const roots = new Set([...Object.keys(rootsMet ?? {}), ...sessions.flatMap((s) => s.roots)]);
  const known = Object.values(states).filter((s) => s === "known").length;
  const learning = Object.values(states).filter((s) => s === "learning").length;
  const recent = [...sessions].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 8);
  const weekday = (d: Date, style: "short" | "long") => d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { weekday: style });
  if (!client) return null;
  return (
    <div className="notebook-journal">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="flex flex-col gap-2" aria-labelledby="journal-week">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 id="journal-week" className="text-[15px] font-semibold">{t("journalWeek")}</h2>
            <span className="text-[12px] text-t3">{t("journalMeta", { sessions: t("sessions", cnt(inWeek.length, locale)), lookups: t("lookups", cnt(inWeek.reduce((a, s) => a + s.lookups, 0), locale)) })}</span>
          </div>
          <ol className="week-chart" aria-label={t("chartLabel")}>
            {week.map((d, i) => (
              <li key={d.key} title={t("dayBar", { day: weekday(d.date, "long"), lookups: t("lookups", cnt(d.n, locale)) })} aria-label={t("dayBar", { day: weekday(d.date, "long"), lookups: t("lookups", cnt(d.n, locale)) })}>
                <span className={"week-bar" + (d.n ? "" : " is-empty")} style={d.n ? { height: `${Math.max(6, (d.n / max) * 44)}px`, opacity: 0.35 + (0.65 * d.n) / max } : undefined} />
                <span className={"text-[11px] " + (i === 6 ? "font-medium text-t1" : "text-t3")}>{weekday(d.date, "short")}</span>
              </li>
            ))}
          </ol>
        </section>
        {recent.length === 0 ? (
          <p className="text-[13px] text-t3">{t("journalEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((s) => {
              const d = new Date(`${s.day}T12:00:00`);
              const notes = items.filter((x) => x.kind !== "trail" && new Date(x.created).toLocaleDateString("en-CA") === s.day);
              return (
                <li key={`${s.day}-${s.text}`} className="session-card">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[13.5px] font-medium">{d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
                    <span className="text-[12px] text-t3">{t("sessionText")} • {t("lookups", cnt(s.lookups, locale))}</span>
                  </div>
                  {s.roots.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11.5px] text-t3">{t("rootsMet")}</span>
                      {s.roots.map((r) => (
                        <Link key={r} href={`/concordance?root=${encodeURIComponent(r)}`} prefetch={false} className="root-chip">{r.split("").join(" ")}</Link>
                      ))}
                      <span className="text-[11.5px] text-t3">• {t("wordsOpened", cnt(s.words.length, locale))}</span>
                    </div>
                  )}
                  {notes.map((n) => (
                    <p key={n.id} className="session-note" dir="auto">{t("noteThatDay", { text: (n.title || n.body).slice(0, 120) })}</p>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <aside className="flex flex-col gap-3">
        <section className="progress-card" aria-labelledby="journal-all">
          <p id="journal-all" className="label-caps">{t("allTime")}</p>
          <p className="text-[15px] font-semibold">{t("allRoots", cnt(roots.size, locale))}</p>
          <p className="text-[12.5px] text-t2">{t("allWords", { known: formatNumber(known, locale), learning: formatNumber(learning, locale) })}</p>
          <p className="text-[12.5px] text-t2">{t("allNotes", { notes: formatNumber(items.filter((x) => x.kind !== "trail").length, locale), starred: formatNumber(starred, locale) })}</p>
        </section>
        <section className="progress-card" aria-labelledby="journal-due">
          <p id="journal-due" className="label-caps">{t("due")}</p>
          {/* the scheduler's queue, not all roots met (NTB-46, 48, Q08) */}
          <p className="text-[15px] font-semibold">{t("dueRoots", cnt(due ?? 0, locale))}</p>
          <Link href="/read?mode=review" className="btn btn-primary self-start">{t("review")}</Link>
        </section>
        <p className="text-[11.5px] leading-relaxed text-t3">{t("noStreak")}</p>
      </aside>
    </div>
  );
}
