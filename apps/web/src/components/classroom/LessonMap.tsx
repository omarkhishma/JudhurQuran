"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Composer, useMapComments } from "@/components/graph/Comments";
import type { SplitMessage } from "@/components/graph/SplitReceiver";
import { Link } from "@/i18n/navigation";
import { cardRef, decideProposal, getActivity, getProposals, rangesLine, sendProposal, setLessonMap, withdrawProposal, type CardRef, type FeedItem, type LessonOut, type Proposal } from "@/lib/classroom";
import { setLocalStorage, useLocalStorage } from "@/lib/client";
import { cnt, verseRef } from "@/lib/format";
import { upgrade } from "@/lib/graph/migrate";
import { createGraph, deleteGraph, loadGraph, markShared, storedAt } from "@/lib/graph/persist";
import { markCommentsRead, readShared, shareMap } from "@/lib/graph/shared";
import { rootCards } from "@/lib/graph/seed";
import { sourceHeading } from "@/lib/graph/topics";
import type { GraphEdge, GraphNode } from "@/lib/graph/types";
import { useClassError, useFmt, useSurahNames } from "./shared";

/**
 * A lesson's map (P9.3; CLS-27…42, 45, 46, Q06, H01, H04): one map its instructor shares, read by the class only. The
 * instructor makes it (the lesson's roots on it) and edits it in the real editor, framed here; a member reads it
 * framed, and proposes by working on their own copy in the same frame and sending what they added. Beside it, tabs
 * that each show their own content: the activity in the product's words with a comment box, the proposals waiting
 * (dashed, with their author) confirmed into the instructor's open editor or declined, the map's topics, and the
 * lesson notes.
 */
export function LessonMap({ lesson, teach, notes }: { lesson: LessonOut; teach: boolean; notes: ReactNode }) {
  const t = useTranslations("classroom");
  if (!lesson.map)
    return teach ? (
      <MakeMap lesson={lesson} />
    ) : (
      <p className="rounded-xl border border-dashed border-line-2 p-6 text-[14px] text-t2">{t("mapNoneMember")}</p>
    );
  return <MapRoom lesson={lesson} teach={teach} notes={notes} gid={lesson.map.id} />;
}

/** The instructor makes the lesson's map: a heading with the lesson's title and verses, and its roots; shared at once
 * and named for the lesson, so the class reads it and no one else. */
function MakeMap({ lesson }: { lesson: LessonOut }) {
  const t = useTranslations("classroom");
  const qc = useQueryClient();
  const names = useSurahNames();
  const fmt = useFmt();
  const fail = useClassError();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  async function make() {
    setBusy(true);
    setSaid("");
    try {
      const roots = await Promise.all(lesson.roots.map((r) => rootCards(r.key).catch(() => null)));
      const head: GraphNode = { id: `note:${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`, type: "card", position: { x: 0, y: 0 }, data: { kind: "note", text: `${lesson.title} — ${rangesLine(lesson.ranges, names, fmt)}` } };
      const nodes = [head, ...roots.flatMap((r) => r?.nodes ?? [])];
      const title = t("mapTitle", { title: lesson.title });
      const kind = lesson.roots.length ? "root" : "free";
      const local = await createGraph({ title, kind, nodes, edges: [], pendingLayout: true });
      const shared = await shareMap(local, { title, kind, nodes, edges: [] });
      // this browser's copy follows the shared one from now on, as a map shared from the editor does
      await markShared(local, { id: shared.id, revision: shared.revision }, (await storedAt(local)) ?? Date.now());
      await setLessonMap(lesson.id, shared.id);
      await qc.invalidateQueries({ queryKey: ["lesson", lesson.id] });
    } catch (e) {
      setSaid(fail(e));
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="makemap-h" className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line-2 p-6">
      <h2 id="makemap-h" className="text-[16px] font-semibold">{t("mapMakeTitle")}</h2>
      <p className="max-w-[640px] text-[13.5px] leading-relaxed text-t2">{t("mapMakeLead")}</p>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void make()}>{t("mapMake")}</button>
      <p role="status" className="text-[12.5px] text-t2">{said}</p>
    </section>
  );
}

/** The frame and what it says: whether it edits, and its answers to what it was asked. */
function useFrame(ref: RefObject<HTMLIFrameElement | null>, onChanged?: () => void) {
  // null: not said yet; true: an editor that edits now; false: a map read, or an editor another window holds
  const [editor, setEditor] = useState<boolean | null>(null);
  const waiting = useRef(new Map<string, (m: SplitMessage | null) => void>());
  const changed = useRef(onChanged);
  useEffect(() => {
    changed.current = onChanged;
  });
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || !ref.current || e.source !== ref.current.contentWindow) return;
      const m = e.data as SplitMessage;
      if (m?.type === "jadhr:ready") setEditor(!!m.editor);
      if (m?.type === "jadhr:changed") changed.current?.();
      const id = (m as { ref?: unknown })?.ref;
      if (typeof id === "string" && waiting.current.has(id)) {
        waiting.current.get(id)!(m);
        waiting.current.delete(id);
      }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [ref]);
  const post = (m: SplitMessage) => ref.current?.contentWindow?.postMessage(m, location.origin);
  /** Ask the frame and wait for its answer, or for nothing after a few seconds. */
  const ask = (m: SplitMessage, ms = 8000) =>
    new Promise<SplitMessage | null>((resolve) => {
      const id = (m as { ref: string }).ref;
      waiting.current.set(id, resolve);
      post(m);
      setTimeout(() => {
        if (waiting.current.delete(id)) resolve(null);
      }, ms);
    });
  const loaded = () => {
    setEditor(null);
    post({ type: "jadhr:ping" });
  };
  return { editor, post, ask, loaded };
}

const rid = () => crypto.randomUUID();
type Draft = { fork: string; gid: string };
const DRAFT = (lesson: string) => `jadhr-class-draft:${lesson}`;

function readDraft(raw: string | null, gid: string): Draft | null {
  try {
    const d = raw ? (JSON.parse(raw) as Partial<Draft>) : null;
    return d && typeof d.fork === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(d.fork) && d.gid === gid ? { fork: d.fork, gid } : null;
  } catch {
    return null;
  }
}

function MapRoom({ lesson, teach, notes, gid }: { lesson: LessonOut; teach: boolean; notes: ReactNode; gid: string }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const qc = useQueryClient();
  // the server said the map changed (B47, through the frame): the feed, the proposals and the map's topics look again
  const frame = useFrame(frameRef, () => {
    for (const k of [["activity", lesson.id], ["proposals", lesson.id], ["lesson-map-doc", gid], ["lesson", lesson.id]]) void qc.invalidateQueries({ queryKey: k });
  });
  const draft = readDraft(useLocalStorage(DRAFT(lesson.id)), gid);
  // a member with a draft works on it in the frame, or looks at the class's map again
  const [onDraft, setOnDraft] = useState(true);
  const drafting = !teach && !!draft && onDraft;
  const src = drafting ? `/${locale}/graph/edit/${draft!.fork}` : `/${locale}/graph/shared/${gid}`;
  const editorHref = teach ? (lesson.map?.local_id ? `/graph/edit/${lesson.map.local_id}` : `/graph/shared/${gid}`) : drafting ? `/graph/edit/${draft!.fork}` : `/graph/shared/${gid}`;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex min-w-0 flex-col gap-2" aria-labelledby="map-h">
        <h2 id="map-h" className="sr-only">{t("mapRegion")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* what this map is, beside it rather than over its canvas (CLS-28, H04) */}
          <span className="map-pill">{t("mapPill")}</span>
          <span className="flex-1" />
          {!teach && !draft && lesson.open && <StartDraft lesson={lesson} gid={gid} onStarted={() => setOnDraft(true)} />}
          {!teach && draft && !onDraft && (
            <button type="button" className="btn" onClick={() => setOnDraft(true)}>{t("draftBack")}</button>
          )}
          <Link href={editorHref} className="btn">{t("openInEditor")}</Link>
        </div>
        {!teach && draft && onDraft && <DraftBar lesson={lesson} draft={draft} frame={frame} onClass={() => setOnDraft(false)} />}
        {teach && frame.editor === false && <p className="rounded-lg border border-line bg-card-2 px-3 py-2 text-[12.5px] text-t1" role="status">{t("mapNotEditingHere")}</p>}
        <iframe key={src} ref={frameRef} className="lesson-map-frame" title={t(drafting ? "draftFrame" : "mapFrame")} src={src} onLoad={frame.loaded} />
      </section>
      <SidePanel lesson={lesson} teach={teach} gid={gid} frame={frame} notes={notes} />
    </div>
  );
}

/** A member starts proposing: their own copy of the class's map, kept in their browser until they send what they added. */
function StartDraft({ lesson, gid, onStarted }: { lesson: LessonOut; gid: string; onStarted: () => void }) {
  const t = useTranslations("classroom");
  const fail = useClassError();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const cls = await readShared(gid);
            const { nodes, edges } = await upgrade(cls.doc.version, cls.kind, cls.doc.nodes, cls.doc.edges);
            const fork = await createGraph({ title: t("draftTitle", { title: lesson.title }), kind: cls.kind, nodes, edges });
            setLocalStorage(DRAFT(lesson.id), JSON.stringify({ fork, gid }));
            onStarted();
          } catch (e) {
            setSaid(fail(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("proposeStart")}
      </button>
      {said && <span role="status" className="text-[12.5px] text-t2">{said}</span>}
    </>
  );
}

/** The member's draft: what they add is sent as a proposal, under their name for the class to see. */
function DraftBar({ lesson, draft, frame, onClass }: { lesson: LessonOut; draft: Draft; frame: ReturnType<typeof useFrame>; onClass: () => void }) {
  const t = useTranslations("classroom");
  const qc = useQueryClient();
  const fail = useClassError();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const [dropping, setDropping] = useState(false);
  const clear = async () => {
    await deleteGraph(draft.fork);
    setLocalStorage(DRAFT(lesson.id), "");
  };
  async function send() {
    setBusy(true);
    setSaid("");
    try {
      // the map as it is in the frame now, else as last kept in this browser
      const got = frame.editor !== null ? await frame.ask({ type: "jadhr:get-doc", ref: rid() }) : null;
      const kept = got?.type === "jadhr:doc" ? got : await loadGraph(draft.fork);
      const cls = await readShared(draft.gid);
      const onMap = new Set(cls.doc.nodes.map((n) => n.id));
      const linksOn = new Set(cls.doc.edges.map((e) => e.id));
      const cards = (kept?.nodes ?? []).filter((n) => !onMap.has(n.id));
      const ends = new Set([...onMap, ...cards.map((c) => c.id)]);
      const links = (kept?.edges ?? []).filter((e) => !linksOn.has(e.id) && ends.has(e.source) && ends.has(e.target));
      if (!cards.length && !links.length) {
        setSaid(t("draftEmpty"));
        return;
      }
      await sendProposal(lesson.id, {
        base: cls.revision,
        cards: cards.map(({ id, position, data }) => ({ id, position, data }) as GraphNode),
        links: links.map(({ id, source, target, data }) => ({ id, source, target, data }) as GraphEdge),
        note: note.trim(),
      });
      await clear();
      setNote("");
      onClass();
      for (const k of ["proposals", "activity", "lesson"]) await qc.invalidateQueries({ queryKey: [k, lesson.id] });
    } catch (e) {
      setSaid(fail(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="draft-bar flex flex-col gap-2 rounded-lg border px-3 py-2" role="region" aria-label={t("draftRegion")}>
      <p className="text-[13px] leading-relaxed text-t1">{t("draftLead")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input className="field-input min-w-0 basis-full sm:basis-0 sm:flex-1" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder={t("draftNoteHint")} aria-label={t("draftNote")} dir="auto" />
        <button type="button" className="btn btn-primary" disabled={busy || !lesson.open} onClick={() => void send()}>{t("draftSend")}</button>
        <button type="button" className="btn" onClick={onClass}>{t("draftToClass")}</button>
        {dropping ? (
          <button
            type="button"
            className="btn text-bad"
            onClick={async () => {
              await clear();
              onClass();
            }}
          >
            {t("draftDropConfirm")}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => setDropping(true)}>{t("draftDrop")}</button>
        )}
      </div>
      <p role="status" className="text-[12.5px] text-t2">{said}</p>
    </div>
  );
}

type Tab = "activity" | "proposals" | "topics" | "notes";

/** The side tabs (CLS-31, 32): each shows its own content. */
function SidePanel({ lesson, teach, gid, frame, notes }: { lesson: LessonOut; teach: boolean; gid: string; frame: ReturnType<typeof useFrame>; notes: ReactNode }) {
  const t = useTranslations("classroom");
  const fmt = useFmt();
  const [tab, setTab] = useState<Tab>(teach && lesson.pending > 0 ? "proposals" : "activity");
  const doc = useQuery({ queryKey: ["lesson-map-doc", gid], queryFn: () => readShared(gid), refetchInterval: 30_000, refetchOnWindowFocus: true });
  const proposals = useQuery({ queryKey: ["proposals", lesson.id], queryFn: () => getProposals(lesson.id), refetchInterval: 30_000, refetchOnWindowFocus: true });
  const topics = (doc.data?.doc.nodes ?? []).filter((n) => sourceHeading(n.id) || n.id.startsWith("note:mytopic"));
  const waiting = (proposals.data?.data ?? []).filter((p) => p.status === "pending").length;
  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: "activity", label: t("tabActivity") },
    { id: "proposals", label: t("tabProposals"), n: waiting },
    { id: "topics", label: t("tabTopics"), n: topics.length },
    { id: "notes", label: t("tabNotes") },
  ];
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={t("mapSide")}>
      <div className="side-tabs" role="tablist" aria-label={t("mapSide")}>
        {tabs.map((x) => (
          <button key={x.id} type="button" role="tab" id={`side-${x.id}`} aria-selected={tab === x.id} aria-controls={`side-${x.id}-panel`} className="side-tab" onClick={() => setTab(x.id)}>
            {x.label}
            {x.n ? <span className="side-count">{fmt(x.n)}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`side-${tab}-panel`} aria-labelledby={`side-${tab}`} className="flex flex-col gap-3">
        {tab === "activity" && <Activity lesson={lesson} gid={gid} />}
        {tab === "proposals" && <Proposals lesson={lesson} teach={teach} frame={frame} data={proposals.data?.data} doc={doc.data?.doc.nodes} />}
        {tab === "topics" &&
          (topics.length ? (
            <ul className="flex flex-col gap-1">
              {topics.map((n) => (
                <li key={n.id}>
                  <button type="button" className="topic-row" onClick={() => frame.post({ type: "jadhr:focus", id: n.id })}>
                    <span dir="auto">{(n.data.ar || n.data.text || n.data.title || "").slice(0, 80)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-t3">{t("topicsNone")}</p>
          ))}
        {tab === "notes" && notes}
      </div>
    </section>
  );
}

/** Times as a reader says them: just now, minutes ago, yesterday. */
function useAgo() {
  const locale = useLocale();
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-EG" : "en", { numeric: "auto" });
  return (iso: string) => {
    const s = (new Date(iso).getTime() - Date.now()) / 1000;
    const a = Math.abs(s);
    return a < 60 ? rtf.format(0, "second") : a < 3600 ? rtf.format(Math.round(s / 60), "minute") : a < 86400 ? rtf.format(Math.round(s / 3600), "hour") : rtf.format(Math.round(s / 86400), "day");
  };
}

/** Cards named as the reader reads them: a verse by its place in their digits, the rest by their name; four, then how
 * many more. */
function useLabels() {
  const t = useTranslations("classroom");
  const locale = useLocale();
  return (cards: CardRef[], bare = false) => {
    // a verse is named as one: «آية ١:٢» (bare where its kind is said beside it)
    const one = (c: CardRef) => (c.kind === "verse" && /^\d{1,3}:\d{1,3}$/.test(c.label) ? `${bare ? "" : `${t("kind_verse")} `}${verseRef(c.label, locale)}` : c.label || t(`kind_${c.kind}`));
    const shown = cards.slice(0, 4).map(one).join(locale === "ar" ? "، " : ", ");
    return cards.length > 4 ? `${shown} ${t("andMore", cnt(cards.length - 4, locale))}` : shown;
  };
}

/** The feed (CLS-36…41): newest first, each entry what it touched in the product's words, its dot coloured by the
 * kind of card; a comment on the whole map, anyone in the class mentioned. */
function Activity({ lesson, gid }: { lesson: LessonOut; gid: string }) {
  const t = useTranslations("classroom");
  const qc = useQueryClient();
  const comments = useMapComments(gid);
  const q = useInfiniteQuery({
    queryKey: ["activity", lesson.id],
    queryFn: ({ pageParam }) => getActivity(lesson.id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  // the feed shows the map's comments: shown, they are read
  const said = items.filter((x) => x.kind === "commented").length;
  useEffect(() => {
    if (said > 0) void markCommentsRead(gid).catch(() => {});
  }, [gid, said]);
  return (
    <div className="flex flex-col gap-3">
      <Composer gid={gid} people={comments.data?.people ?? []} hint={t("feedCommentHint")} onSent={() => void qc.invalidateQueries({ queryKey: ["activity", lesson.id] })} />
      {q.isPending ? (
        <span className="block h-24 animate-pulse rounded-lg bg-card-2" aria-hidden="true" />
      ) : items.length ? (
        <ol className="flex flex-col gap-2.5" aria-label={t("tabActivity")}>
          {items.map((x) => (
            <FeedEntry key={x.id} x={x} />
          ))}
        </ol>
      ) : (
        <p className="text-[12.5px] text-t3">{t("feedNone")}</p>
      )}
      {q.hasNextPage && (
        <button type="button" className="btn self-start text-[12.5px]" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t("feedOlder")}</button>
      )}
    </div>
  );
}

function FeedEntry({ x }: { x: FeedItem }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const ago = useAgo();
  const labels = useLabels();
  const d = x.detail;
  const who = x.who.me ? t("you") : (x.who.name ?? t("aReader"));
  const first = (d.added ?? d.cards ?? d.removed ?? [])[0] ?? d.card ?? null;
  const parts: string[] = [];
  if (x.kind === "edited") {
    if (d.added?.length) parts.push(t("feedAdded", { ...cnt(d.added.length, locale), labels: labels(d.added) }));
    if (d.removed?.length) parts.push(t("feedRemoved", { ...cnt(d.removed.length, locale), labels: labels(d.removed) }));
    if (d.linked) parts.push(t("feedLinked", cnt(d.linked, locale)));
    if (d.unlinked) parts.push(t("feedUnlinked", cnt(d.unlinked, locale)));
  } else if (x.kind === "proposed") {
    parts.push(d.cards?.length ? t("feedProposed", { labels: labels(d.cards) }) : t("feedProposedLinks"));
    if (d.links) parts.push(t("feedLinked", cnt(d.links, locale)));
  } else if (x.kind === "confirmed" || x.kind === "declined") {
    parts.push(t(x.kind === "confirmed" ? "feedConfirmed" : "feedDeclined", { name: d.for ?? t("aReader"), labels: d.cards?.length ? labels(d.cards) : t("feedLinksOnly") }));
  } else {
    parts.push(d.card ? t("feedCommentOn", { card: labels([d.card]) }) : t(d.reply ? "feedReply" : "feedComment"));
  }
  return (
    <li className="feed-entry">
      <span className="feed-dot" data-kind={x.kind === "commented" ? "comment" : (first?.kind ?? "note")} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-relaxed text-t1">
          <b className="font-semibold" dir="auto">{who}</b> · {parts.join(" · ")}
        </p>
        {x.kind === "commented" && d.body && <p className="feed-quote" dir="auto">{d.body}</p>}
        <time className="text-[11px] text-t3" dateTime={x.at}>{ago(x.at)}</time>
      </div>
    </li>
  );
}

/** Proposals (CLS-33…35): each as dashed cards with its author and note; the instructor confirms one into the editor
 * open beside them — one step undo takes back, saved as a revision — or declines it; a member takes their own back
 * while it waits. */
function Proposals({ lesson, teach, frame, data, doc }: { lesson: LessonOut; teach: boolean; frame: ReturnType<typeof useFrame>; data: Proposal[] | undefined; doc: GraphNode[] | undefined }) {
  const t = useTranslations("classroom");
  const qc = useQueryClient();
  const fail = useClassError();
  const ago = useAgo();
  const labels = useLabels();
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const names = new Map((doc ?? []).map((n) => [n.id, cardRef(n)]));
  const refresh = async () => {
    for (const k of ["proposals", "activity", "lesson"]) await qc.invalidateQueries({ queryKey: [k, lesson.id] });
  };
  async function confirm(p: Proposal) {
    const name = p.by.name ?? t("aReader");
    if (!frame.editor) return setSaid(t("confirmNeedsEditor"));
    setBusy(p.id);
    try {
      const r = await frame.ask({ type: "jadhr:merge", ref: rid(), nodes: p.cards, edges: p.links, label: t("doMerge", { name }) });
      if (!r) return setSaid(t("confirmNoAnswer"));
      if (r.type === "jadhr:merge-refused") return setSaid(t("confirmLocked"));
      await decideProposal(p.id, "confirmed");
      setSaid(t("confirmedSaid", { name }));
      await refresh();
    } catch (e) {
      setSaid(fail(e));
    } finally {
      setBusy(null);
    }
  }
  async function act(p: Proposal, run: () => Promise<unknown>, done: string) {
    setBusy(p.id);
    try {
      await run();
      setSaid(done);
      await refresh();
    } catch (e) {
      setSaid(fail(e));
    } finally {
      setBusy(null);
    }
  }
  const list = data ?? [];
  const waiting = list.filter((p) => p.status === "pending");
  const decided = list.filter((p) => p.status !== "pending");
  const one = (p: Proposal) => {
    const cards = p.cards.map(cardRef);
    const here = new Map([...names, ...cards.map((c) => [c.id, c] as const)]);
    return (
      <li key={p.id} className="proposal flex flex-col gap-2 rounded-lg border border-line p-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <b className="text-[13px] font-semibold" dir="auto">{p.by.me ? t("you") : (p.by.name ?? t("aReader"))}</b>
          <time className="text-[11px] text-t3" dateTime={p.created_at}>{ago(p.created_at)}</time>
          {p.status !== "pending" && <span className={"state-chip" + (p.status === "confirmed" ? " is-approved" : "")}>{t(`proposal_${p.status}`)}</span>}
        </div>
        {p.note && <p className="text-[12.5px] text-t2" dir="auto">{p.note}</p>}
        {cards.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t("proposalCards")}>
            {cards.map((c) => (
              <li key={c.id} className="proposal-card" data-kind={c.kind}>
                <span className="text-[10.5px] text-t3">{t(`kind_${c.kind}`)}</span>
                <span className={c.kind === "root" ? "ar-classical text-[15px]" : c.kind === "lemma" ? "quran text-[17px]" : "text-[12.5px]"} dir="auto">{labels([c], true)}</span>
              </li>
            ))}
          </ul>
        )}
        {p.links.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-[12px] text-t2" aria-label={t("proposalLinks")}>
            {p.links.map((l) => (
              <li key={l.id} dir="auto">
                {labels([here.get(l.source) ?? { id: l.source, kind: "note", label: "" }])} ← {labels([here.get(l.target) ?? { id: l.target, kind: "note", label: "" }])}
              </li>
            ))}
          </ul>
        )}
        {p.status === "pending" && (
          <div className="flex flex-wrap gap-2">
            {teach ? (
              <>
                <button type="button" className="btn btn-primary text-[12.5px]" disabled={busy === p.id} onClick={() => void confirm(p)}>{t("confirm")}</button>
                <button type="button" className="btn text-[12.5px]" disabled={busy === p.id} onClick={() => void act(p, () => decideProposal(p.id, "declined"), t("declinedSaid", { name: p.by.name ?? t("aReader") }))}>{t("decline")}</button>
              </>
            ) : (
              p.by.me && <button type="button" className="btn text-[12.5px]" disabled={busy === p.id} onClick={() => void act(p, () => withdrawProposal(p.id), t("withdrawnSaid"))}>{t("withdraw")}</button>
            )}
          </div>
        )}
      </li>
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <h3 className="label-caps">{t(teach ? "awaitingYou" : "awaiting")}</h3>
      {teach && <p className="text-[12px] leading-relaxed text-t3">{t("awaitingLead")}</p>}
      {!teach && <p className="text-[12px] leading-relaxed text-t3">{t("proposeLead")}</p>}
      {waiting.length ? <ul className="flex flex-col gap-2">{waiting.map(one)}</ul> : <p className="text-[12.5px] text-t3">{t("awaitingNone")}</p>}
      <p role="status" className="text-[12.5px] text-t2">{said}</p>
      {decided.length > 0 && (
        <>
          <h3 className="label-caps">{t(teach ? "decided" : "decidedMine")}</h3>
          <ul className="flex flex-col gap-2">{decided.map(one)}</ul>
        </>
      )}
    </div>
  );
}
