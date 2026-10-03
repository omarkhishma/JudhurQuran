"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { cnt, cnt2, formatNumber, toArabicDigits } from "@/lib/format";
import { buildSeedGraph } from "@/lib/graph/seed";
import { getJSON } from "@/lib/reader/api";
import { usePersonal, useReader, verseRef } from "@/lib/reader/store";
import { noteOn, useSaved } from "@/lib/store/saved";

export type DrawerTool = "roots" | "related" | "concordance" | "links" | "topic" | "note" | "graph";
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
      {tool === "concordance" && <ConcordanceDrawer verseKey={verseKey} />}
      {tool === "links" && <LinksDrawer verseKey={verseKey} />}
      {tool === "topic" && <TopicDrawer verseKey={verseKey} />}
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
  // each root's transliteration and its count in the whole Quran (RDR-154)
  const keys = roots.map(([k]) => k);
  const info = useQuery({
    queryKey: ["roots-by-key", keys.join(",")],
    queryFn: () => getJSON<{ data: { key: string; translit: string; occurrences: number }[] }>(`/roots?keys=${encodeURIComponent(keys.join(","))}&limit=${keys.length}`),
    enabled: keys.length > 0,
    staleTime: Infinity,
  });
  const byKey = new Map((info.data?.data ?? []).map((r) => [r.key, r]));
  if (v.isError) return <p className="text-[12.5px] text-bad" role="alert">{t("loadFailed")}</p>;
  if (v.data && roots.length === 0) return <p className="text-[12.5px] text-t3">{t("noRootsInVerse")}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {roots.map(([k, n]) => (
        <li key={k}>
          <button type="button" className={"rail-root" + (focusRoot === k ? " is-on" : "")} aria-pressed={focusRoot === k} onClick={() => setFocusRoot(focusRoot === k ? null : k)} title={t("highlightRootTitle", { root: k })}>
            <span className="ar-classical min-w-[72px] text-[19px] tracking-[.06em] text-root" lang="ar">{k.split("").join(" ")}</span>
            {byKey.get(k) && <span className="mono text-[10.5px] text-t3" dir="ltr" lang="en">{byKey.get(k)!.translit}</span>}
            <span className="flex-1" />
            <span className="mono text-[11px] text-t3">
              {t("timesHere", cnt(n, locale))}
              {byKey.get(k) && ` · ${t("inQuranN", { n: formatNumber(byKey.get(k)!.occurrences, locale) })}`}
            </span>
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
      {q.data && q.data.data.length === 0 && <p className="text-[12.5px] text-t3">{t("relatedNone")}</p>}
      {q.isError && <p className="text-[12.5px] text-bad" role="alert">{t("loadFailed")}</p>}
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
  const note = useSaved((s) => noteOn(s, verseKey));
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
  const tg = useTranslations("graph");
  const setHandoff = useReader((s) => s.setHandoff);
  const locale = useLocale();
  const built = useQuery({ queryKey: ["seed-graph", JSON.stringify({ seed: "verse", key: verseKey })], queryFn: () => buildSeedGraph({ seed: "verse", key: verseKey }), staleTime: 5 * 60_000 });
  const cols = (kind: "root" | "lemma" | "word") => (built.data?.nodes ?? []).filter((n) => n.data.kind === kind);
  const [roots, lemmas, words] = [cols("root"), cols("lemma"), cols("word")];
  if (built.isError) return <p className="text-[12.5px] text-bad" role="alert">{t("loadFailed")}</p>;
  if (!built.data) return <div className="h-20 animate-pulse rounded-lg bg-card-2" />;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-t2">{t("graphPreview", { ...cnt(roots.length, locale), ...cnt2(words.length, locale) })}</p>
      <div className="graph-cols">
        {(
          [
            ["kindRoot", roots, "text-root"],
            ["kindLemma", lemmas, "text-form"],
            ["kindWord", words, "text-word"],
          ] as const
        ).map(([label, list, color]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1">
            <p className="label-caps">{tg(label)} · {formatNumber(list.length, locale)}</p>
            <div className="flex flex-wrap gap-1">
              {list.map((n) => (
                <span key={n.id} className={`ar-classical text-[16px] ${color}`} lang="ar">{n.data.ar}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-t3">
        <span className="dot" style={{ background: "var(--c-sentence)" }} />
        {t("graphFootnote")}
      </p>
      <button type="button" className="btn self-start" onClick={() => setHandoff({ seed: "verse", key: verseKey })}>{t("openInEditor")}</button>
    </div>
  );
}

type VerseText = { key: string; surah: number; ayah: number; text_qpc: string };
const KEY = /^(\d{1,3}):(\d{1,3})$/;

/** "2:255", "٢:٢٥٥", "2 255" → "2:255"; anything else → null. */
function parseKey(raw: string): string | null {
  const latin = raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).trim().replace(/\s+|[\u060C,.-]/g, ":");
  const m = KEY.exec(latin.replace(/:+/g, ":"));
  return m ? `${Number(m[1])}:${Number(m[2])}` : null;
}

function LinkedVerse({ refKey, onUnlink }: { refKey: string; onUnlink?: () => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const key = refKey.replace(/^quran:/, "");
  const v = useQuery({ queryKey: ["verse-text", key], queryFn: () => getJSON<VerseText>(`/verses/${key}`), staleTime: Infinity });
  const [s, a] = key.split(":");
  return (
    <li className="link-row">
      <span className="mono text-[11.5px] text-t3" dir="ltr">{locale === "ar" ? toArabicDigits(key) : key}</span>
      <span className="quran line-clamp-1 min-w-0 flex-1 text-[16px] leading-[2]" lang="ar" dir="rtl">{v.data?.text_qpc ?? "…"}</span>
      <Link href={`/quran/${s}/${a}`} className="text-[12px] text-t2 underline-offset-2 hover:underline">{t("openVerse")}</Link>
      {onUnlink && (
        <button type="button" className="text-[12px] text-t3 underline-offset-2 hover:text-bad hover:underline" onClick={onUnlink}>
          {t("unlink")}
        </button>
      )}
    </li>
  );
}

/**
 * Links (RDR-156, adapted per RDR-555): the reader binds this verse to another by hand — by typing its
 * reference or from the verses that share its roots — and sees the verses that link here. Kept on this
 * device, keyed with their text so they never collide across texts.
 */
export function LinksDrawer({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const me = verseRef(verseKey);
  const links = usePersonal((s) => s.links);
  const toggleLink = usePersonal((s) => s.toggleLink);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const out = links[me] ?? [];
  const incoming = Object.entries(links)
    .filter(([from, to]) => from !== me && to.includes(me))
    .map(([from]) => from);
  const related = useQuery({ queryKey: ["related", verseKey], queryFn: () => getJSON<Related>(`/verses/${verseKey}/related?limit=4`) });
  async function add(raw: string) {
    const key = parseKey(raw);
    if (!key) return setError(t("linkInvalid"));
    if (key === verseKey) return setError(t("linkSelf"));
    const ok = await fetch(`/api/v1/verses/${key}`).then((r) => r.ok).catch(() => false);
    if (!ok) return setError(t("linkInvalid"));
    if (!out.includes(verseRef(key))) toggleLink(me, verseRef(key));
    setDraft("");
    setError(null);
  }
  return (
    <div className="flex flex-col gap-2">
      {out.length ? (
        <ul className="flex flex-col">{out.map((r) => <LinkedVerse key={r} refKey={r} onUnlink={() => toggleLink(me, r)} />)}</ul>
      ) : (
        <p className="text-[12px] text-t3">{t("linksEmpty")}</p>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add(draft);
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} className="field h-9 max-w-[200px]" placeholder="٢:٢٥٥" aria-label={t("linkInputLabel")} dir="ltr" />
        <button type="submit" className="btn" disabled={!draft.trim()}>{t("linkAdd")}</button>
        {error && <span className="text-[12px] text-bad" role="alert">{error}</span>}
      </form>
      {(related.data?.data ?? []).some((r) => !out.includes(verseRef(r.verse.key))) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-t3">{t("linkSuggest")}</span>
          {related.data!.data
            .filter((r) => !out.includes(verseRef(r.verse.key)))
            .map((r) => (
              <button key={r.verse.key} type="button" className="chip" onClick={() => toggleLink(me, verseRef(r.verse.key))} title={r.verse.name_ar}>
                <span className="mono" dir="ltr">{locale === "ar" ? toArabicDigits(r.verse.key) : r.verse.key}</span>
              </button>
            ))}
        </div>
      )}
      {incoming.length > 0 && (
        <>
          <p className="label-caps mt-1">{t("linksIncoming")}</p>
          <ul className="flex flex-col">{incoming.map((r) => <LinkedVerse key={r} refKey={r} />)}</ul>
        </>
      )}
    </div>
  );
}

/** Topics (RDR-157, adapted per RDR-555): the reader's own topics — made here, a verse gathered under any
 * number of them; the prototype's five fixed labels are gone. */
export function TopicDrawer({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const me = verseRef(verseKey);
  const topics = usePersonal((s) => s.topics);
  const mine = usePersonal((s) => s.verseTopics[me]) ?? [];
  const addTopic = usePersonal((s) => s.addTopic);
  const toggle = usePersonal((s) => s.toggleVerseTopic);
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-col gap-2">
      {topics.length ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("drawer_topic")}>
          {topics.map((tp) => (
            <button key={tp.id} type="button" className={"chip topic-chip" + (mine.includes(tp.id) ? " is-on" : "")} aria-pressed={mine.includes(tp.id)} onClick={() => toggle(me, tp.id)} dir="auto">
              {tp.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-t3">{t("topicsEmpty")}</p>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          const id = addTopic(draft);
          if (!mine.includes(id)) toggle(me, id);
          setDraft("");
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} className="field h-9 max-w-[220px]" placeholder={t("topicNew")} aria-label={t("topicNew")} dir="auto" maxLength={60} />
        <button type="submit" className="btn" disabled={!draft.trim()}>{t("topicAdd")}</button>
      </form>
    </div>
  );
}

/** Concordance from a verse (RDR-150, 496): each root it is built on, opening the concordance across the
 * Quran or in this sūra. */
function ConcordanceDrawer({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const v = useVerse(verseKey);
  const surah = verseKey.split(":")[0];
  const keys = [...new Set((v.data?.words ?? []).map((w) => w.root).filter((r): r is string => !!r))];
  const info = useQuery({
    queryKey: ["roots-by-key", keys.join(",")],
    queryFn: () => getJSON<{ data: { key: string; translit: string; occurrences: number }[] }>(`/roots?keys=${encodeURIComponent(keys.join(","))}&limit=${keys.length}`),
    enabled: keys.length > 0,
    staleTime: Infinity,
  });
  const byKey = new Map((info.data?.data ?? []).map((r) => [r.key, r]));
  if (v.isError) return <p className="text-[12.5px] text-bad" role="alert">{t("loadFailed")}</p>;
  if (v.data && keys.length === 0) return <p className="text-[12.5px] text-t3">{t("noRootsInVerse")}</p>;
  return (
    <ul className="flex flex-col">
      {keys.map((k) => (
        <li key={k} className="link-row">
          <span className="ar-classical min-w-[72px] text-[18px] tracking-[.06em] text-root" lang="ar">{k.split("").join(" ")}</span>
          <span className="mono min-w-0 flex-1 truncate text-[11px] text-t3" dir="ltr" lang="en">{byKey.get(k)?.translit ?? ""}</span>
          <Link href={`/concordance?root=${encodeURIComponent(k)}`} className="text-[12px] text-t2 underline-offset-2 hover:underline">
            {t("concAll", { n: formatNumber(byKey.get(k)?.occurrences ?? 0, locale) })}
          </Link>
          <Link href={`/concordance?root=${encodeURIComponent(k)}&surah=${surah}`} className="text-[12px] text-t2 underline-offset-2 hover:underline">
            {t("inThisSurah")}
          </Link>
        </li>
      ))}
    </ul>
  );
}

