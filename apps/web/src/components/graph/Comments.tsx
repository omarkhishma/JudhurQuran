"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { Icon } from "@/components/Icon";
import { Link, usePathname } from "@/i18n/navigation";
import { MAP_CHANGED } from "@/lib/graph/presence";
import { errorKind } from "@/lib/account/errors";
import { useAccount } from "@/lib/account/store";
import { cnt, formatNumber } from "@/lib/format";
import { foldQuery as fold } from "@/lib/graph/find";
import { META } from "@/lib/graph/relations";
import { deleteComment, getComments, markCommentsRead, postComment, resolveComment, type Comment, type CommentQuote as Quote, type Person } from "@/lib/graph/shared";
import { KIND_COLOR, type ForkRef, type GraphNode } from "@/lib/graph/types";
import { useVerseText } from "@/lib/graph/verseText";
import { ApiError } from "@/lib/account/store";
import { CommentQuote } from "./CommentQuote";
import type { CanvasTools } from "./GraphCanvas";

/**
 * Comments on a shared map (P8.1-E; EDT-190…194, EDT-311, EDT-347, HWF-48): per map, on the server — anchored to a
 * card by its id with the card's Arabic as it was written, or to the whole map; newest first, each thread with its
 * replies in order; resolved and opened again by the map's owner or the comment's author; mentions of the people
 * who have spoken on the map; what is open on a card marked on the card. A private map has no comments: it is
 * shared for them first. Reading them needs an account.
 */

/** The map the canvas shows, as sharing sees it: its shared copy's id (null: private), whose it is, and the way to
 * share it from the editor. */
export type SharedMap = {
  gid: string | null;
  owner: boolean;
  openShare?: () => void;
  /** the map's id in this browser, for its history */
  mapId?: string;
  /** a published version, read (P8.5): no comments, its settings shown read-only (EDT-282, EDT-283, EDT-289) */
  published?: boolean;
  /** the published map this one was copied from (EDT-290), named on it */
  forkedFrom?: ForkRef;
};
export const SharedMapContext = createContext<SharedMap>({ gid: null, owner: true });
export const useSharedMap = () => useContext(SharedMapContext);

export type DetailsTab = "meaning" | "settings" | "comments";
/** The details' tab, and a card a comment marker asked to show (its comments open on it). */
export const useDetailsTab = create<{ tab: DetailsTab; focus: { id: string; at: number } | null; set: (tab: DetailsTab) => void; openOn: (id: string) => void }>((set) => ({
  tab: "meaning",
  focus: null,
  set: (tab) => set({ tab }),
  openOn: (id) => set({ tab: "comments", focus: { id, at: Date.now() } }),
}));

const KEY = (gid: string) => ["graph-comments", gid] as const;

/** A shared map's comments for the signed-in reader, asked again every half minute and on returning to the page — and
 * at once when the server says they changed (B47). */
export function useMapComments(gid: string | null) {
  const session = useAccount((s) => s.session);
  const qc = useQueryClient();
  useEffect(() => {
    if (!gid) return;
    const on = (e: Event) => (e as CustomEvent<string>).detail === gid && void qc.invalidateQueries({ queryKey: KEY(gid) });
    window.addEventListener(MAP_CHANGED, on);
    return () => window.removeEventListener(MAP_CHANGED, on);
  }, [gid, qc]);
  return useQuery({ queryKey: KEY(gid ?? ""), queryFn: () => getComments(gid!), enabled: !!gid && !!session, refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 5_000 });
}

/** The open threads on one card, for its marker. */
export function useOpenOn(id: string): number {
  const { gid } = useSharedMap();
  const q = useMapComments(gid);
  return useMemo(() => (q.data?.data ?? []).filter((c) => c.node_id === id && !c.parent_id && !c.resolved_at && !c.deleted).length, [q.data, id]);
}

/** A card's marker (EDT-194): how many threads are open on it; it opens them in the details. */
export function CommentMarker({ id }: { id: string }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const n = useOpenOn(id);
  if (!n) return null;
  return (
    <button type="button" className="comment-marker nodrag" onClick={() => useDetailsTab.getState().openOn(id)} aria-label={t("commentsOnCard", cnt(n, locale))}>
      <Icon name="comment" size={12} />
      {formatNumber(n, locale)}
    </button>
  );
}

const PALETTE = Object.values(KIND_COLOR);
const colorOf = (id: string | undefined) => (id ? PALETTE[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length] : "var(--line-2)");

/** The Comments tab: for a private map, the way to share it; signed out, the way in; else the threads and the box. */
export function CommentsPanel({ tools }: { tools: CanvasTools }) {
  const t = useTranslations("graph");
  const map = useSharedMap();
  const session = useAccount((s) => s.session);
  const path = usePathname();
  if (!map.gid)
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-[13px] leading-relaxed text-t2">{t("commentsPrivate")}</p>
        {map.openShare && (
          <button type="button" className="btn btn-primary" onClick={map.openShare}>
            {t("shareForComments")}
          </button>
        )}
      </div>
    );
  if (!session)
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-[13px] leading-relaxed text-t2">{t("commentsSignIn")}</p>
        <Link href={`/signin?next=${encodeURIComponent(path)}`} className="btn btn-primary">{t("signInToComment")}</Link>
      </div>
    );
  return <Threads gid={map.gid} tools={tools} />;
}

function Threads({ gid, tools }: { gid: string; tools: CanvasTools }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const q = useMapComments(gid);
  // shown, they are read — and again when a new one arrives while they are shown
  const seen = q.data?.data.length ?? -1;
  useEffect(() => {
    if (seen >= 0) void markCommentsRead(gid).catch(() => {});
  }, [gid, seen]);
  const one = tools.selected.length === 1 ? tools.selected[0] : null;
  const [all, setAll] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [replying, setReplying] = useState<string | null>(null);
  const items = q.data?.data ?? [];
  const people = q.data?.people ?? [];
  const onCard = (c: Comment) => !one || all || c.node_id === one.id;
  const threads = items.filter((c) => !c.parent_id && onCard(c)).reverse();
  const shown = threads.filter((c) => resolved || !c.resolved_at);
  const doneCount = threads.filter((c) => c.resolved_at).length;
  const replies = (id: string) => items.filter((c) => c.parent_id === id);
  if (q.isPending) return <p className="text-[12.5px] text-t3">…</p>;
  if (q.isError) return <p className="text-[12.5px] text-t2" role="alert">{t("commentsFailed")}</p>;
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        {one && (
          <div className="seg-group" role="group" aria-label={t("commentsScope")}>
            <button type="button" className={"seg" + (!all ? " is-on" : "")} aria-pressed={!all} onClick={() => setAll(false)}>{t("commentsThisCard")}</button>
            <button type="button" className={"seg" + (all ? " is-on" : "")} aria-pressed={all} onClick={() => setAll(true)}>{t("commentsAll")}</button>
          </div>
        )}
        {doneCount > 0 && (
          <label className="flex items-center gap-1.5 text-t2">
            <input type="checkbox" checked={resolved} onChange={(e) => setResolved(e.target.checked)} />
            {t("commentsShowResolved", { n: formatNumber(doneCount, locale) })}
          </label>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="text-[12.5px] leading-relaxed text-t3">{t(one && !all ? "commentsNoneHere" : "commentsNone")}</p>
      ) : (
        <ol className="flex flex-col gap-2" aria-label={t("comments")}>
          {shown.map((c) => (
            <li key={c.id} className={"comment-thread" + (c.resolved_at ? " is-resolved" : "")}>
              <CommentItem c={c} gid={gid} tools={tools} onReply={() => setReplying(replying === c.id ? null : c.id)} />
              {replies(c.id).length > 0 && (
                <ol className="comment-replies">
                  {replies(c.id).map((r) => (
                    <li key={r.id}>
                      <CommentItem c={r} gid={gid} tools={tools} />
                    </li>
                  ))}
                </ol>
              )}
              {replying === c.id && <Composer gid={gid} people={people} parent={c} tools={tools} onDone={() => setReplying(null)} autoFocus />}
            </li>
          ))}
        </ol>
      )}
      <Composer gid={gid} people={people} tools={tools} anchor={one} />
    </div>
  );
}

function CommentItem({ c, gid, tools, onReply }: { c: Comment; gid: string; tools: CanvasTools; onReply?: () => void }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terr = useTranslations("account");
  const when = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(c.created_at));
  const there = c.node_id ? tools.nodes.find((n) => n.id === c.node_id) : null;
  const name = c.deleted ? null : (c.author?.name ?? t("aReader"));
  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: KEY(gid) });
    } catch (e) {
      setError(terr(`err.${errorKind(e)}`));
    }
  }
  return (
    <article className="comment" aria-label={c.deleted ? t("commentDeleted") : t("commentBy", { who: name ?? "" })}>
      <span className="comment-avatar" style={{ background: colorOf(c.author?.id) }} aria-hidden="true">
        {name ? [...name][0] : "·"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-t3">
          {c.deleted ? (
            <span className="italic">{t("commentDeleted")}</span>
          ) : (
            <>
              <span className="font-medium text-t1" dir="auto">{name}</span>
              {c.author?.owner && <span> · {t("mapOwner")}</span>}
            </>
          )}
          {!c.parent_id && (
            <>
              {" "}
              {t("commentOn")}{" "}
              {!c.node_id ? (
                <span>{t("commentOnMap")}</span>
              ) : there ? (
                <button
                  type="button"
                  className="comment-anchor"
                  lang="ar"
                  onClick={() => {
                    tools.select(there.id);
                    tools.center(there.id);
                  }}
                >
                  {c.anchor || tools.cardName(there.id)}
                </button>
              ) : (
                <span>
                  <span lang="ar">{c.anchor}</span> ({t("commentCardGone")})
                </span>
              )}
            </>
          )}
        </p>
        {!c.deleted && <Body c={c} />}
        {!c.deleted && c.quote && <CommentQuote quote={c.quote} />}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-t3">
          <time dateTime={c.created_at}>{when}</time>
          {c.resolved_at && <span>· {t("commentResolved")}</span>}
          {onReply && !c.resolved_at && (
            <button type="button" className="comment-act" onClick={onReply}>{t("commentReply")}</button>
          )}
          {c.can_resolve && (
            <button type="button" className="comment-act" onClick={() => void act(() => resolveComment(c.id, !c.resolved_at))}>
              {t(c.resolved_at ? "commentReopen" : "commentResolve")}
            </button>
          )}
          {c.can_delete &&
            (asking ? (
              <span className="flex items-center gap-1.5">
                {t("commentDeleteAsk")}
                <button type="button" className="comment-act text-bad" onClick={() => void act(() => deleteComment(c.id))}>{t("commentDeleteYes")}</button>
                <button type="button" className="comment-act" onClick={() => setAsking(false)}>{t("cancel")}</button>
              </span>
            ) : (
              <button type="button" className="comment-act" onClick={() => setAsking(true)}>{t("commentDelete")}</button>
            ))}
        </p>
        {error && <p className="text-[11.5px] text-bad" role="alert">{error}</p>}
      </div>
    </article>
  );
}

/** A comment's words, the names it mentions marked (and the reader's own when it names them). */
function Body({ c }: { c: Comment }) {
  const names = c.mentions.map((m) => m.name).filter((n): n is string => !!n);
  if (!names.length) return <p className="comment-body" dir="auto">{c.body}</p>;
  const re = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  return (
    <p className="comment-body" dir="auto">
      {c.body.split(re).map((part, i) => (i % 2 ? <mark key={i} className="mention">{part}</mark> : part))}
    </p>
  );
}

/** The box (EDT-192): where the comment goes, the words, @ to mention, Enter to send (Shift+Enter: a new line); the
 * canvas's keys stay out of it. Outside the canvas (a lesson's feed, P9.3) it comments on the whole map, `hint`
 * saying so. */
export function Composer({ gid, people, tools, anchor, parent, onDone, autoFocus, hint, onSent }: { gid: string; people: Person[]; tools?: CanvasTools; anchor?: GraphNode | null; parent?: Comment; onDone?: () => void; autoFocus?: boolean; hint?: string; onSent?: () => void }) {
  const t = useTranslations("graph");
  const terr = useTranslations("account");
  const qc = useQueryClient();
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Person[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [picking, setPicking] = useState(false);
  // a quoted verse that is not one is said at once, and the comment is not sent with it
  const quotedVerse = useVerseText(quote?.kind === "verse" ? quote.key : undefined);
  const noVerse = quote?.kind === "verse" && quotedVerse.isSuccess && !quotedVerse.data;
  const matches = query === null ? [] : people.filter((p) => p.name && fold(p.name).includes(fold(query))).slice(0, 6);
  const open = matches.length > 0;

  function look(v: string, caret: number) {
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(v.slice(0, caret));
    setQuery(m ? m[2] : null);
    setActive(0);
  }
  function choose(p: Person) {
    const el = box.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([^\s@]{0,30})$/, `@${p.name} `);
    const next = before + text.slice(caret);
    setText(next);
    setPicked((x) => (x.some((y) => y.id === p.id) ? x : [...x, p]));
    setQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  }
  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await postComment(gid, {
        body,
        parent_id: parent?.id ?? null,
        node_id: parent ? null : (anchor?.id ?? null),
        anchor: parent || !anchor ? "" : (tools?.cardName(anchor.id) ?? anchor.id),
        mentions: picked.filter((p) => body.includes(`@${p.name}`)).map((p) => p.id),
        quote,
      });
      setText("");
      setPicked([]);
      setQuote(null);
      setPicking(false);
      await qc.invalidateQueries({ queryKey: KEY(gid) });
      onSent?.();
      onDone?.();
    } catch (e) {
      setError(e instanceof ApiError && e.code === "no_such_verse" ? t("quoteNoVerse") : e instanceof ApiError && e.code === "no_such_entry" ? t("quoteUnavailable") : terr(`err.${errorKind(e)}`));
    } finally {
      setBusy(false);
    }
  }
  const target = parent ? t("replyTo", { who: parent.author?.name ?? t("aReader") }) : anchor ? t("anchoredTo", { kind: t(META[anchor.data.kind].label), card: tools?.cardName(anchor.id) ?? anchor.id }) : (hint ?? t("anchorHint"));
  return (
    <form
      className={"comment-composer" + (parent ? " is-reply" : "")}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <p className="text-[11.5px] text-t3" id={`${id}-target`}>{target}</p>
      <div className="relative">
        <textarea
          ref={box}
          className="field-input min-h-[56px] w-full resize-y text-[13.5px]"
          rows={2}
          value={text}
          dir="auto"
          autoFocus={autoFocus}
          placeholder={t("commentPlaceholder")}
          aria-label={parent ? t("replyLabel") : t("commentLabel")}
          aria-describedby={`${id}-target`}
          aria-autocomplete="list"
          aria-controls={open ? `${id}-people` : undefined}
          aria-activedescendant={open ? `${id}-p-${active}` : undefined}
          maxLength={2000}
          onChange={(e) => {
            setText(e.target.value);
            look(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={(e) => {
            // the canvas's keys stay out of the box
            e.stopPropagation();
            if (open) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (a + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                choose(matches[active]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setQuery(null);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            } else if (e.key === "Escape" && parent) onDone?.();
          }}
          onBlur={() => setTimeout(() => setQuery(null), 150)}
        />
        {open && (
          <ul className="mention-list" role="listbox" id={`${id}-people`} aria-label={t("mentionPeople")}>
            {matches.map((p, i) => (
              <li
                key={p.id}
                id={`${id}-p-${i}`}
                role="option"
                aria-selected={i === active}
                className={"mention-option" + (i === active ? " is-active" : "")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
              >
                <span className="comment-avatar" style={{ background: colorOf(p.id) }} aria-hidden="true">{[...(p.name ?? "·")][0]}</span>
                <span dir="auto">{p.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {quote ? (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <CommentQuote quote={quote} max={160} />
          </div>
          <button type="button" className="field-remove" onClick={() => setQuote(null)} aria-label={t("quoteRemove")}>×</button>
        </div>
      ) : picking ? (
        <QuotePicker tools={tools} anchor={anchor} onPick={(q) => { setQuote(q); setPicking(false); }} onCancel={() => setPicking(false)} />
      ) : null}
      <div className="flex items-center gap-2">
        {!quote && !picking && (
          <button type="button" className="comment-act text-[11.5px]" onClick={() => setPicking(true)}>{t("quoteAdd")}</button>
        )}
        {error && <p className="flex-1 text-[11.5px] text-bad" role="alert">{error}</p>}
        <span className="flex-1" />
        {parent && (
          <button type="button" className="btn text-[12.5px]" onClick={onDone}>{t("cancel")}</button>
        )}
        <button type="submit" className="btn btn-primary text-[12.5px]" disabled={busy || !text.trim() || noVerse}>{t("commentSend")}</button>
      </div>
    </form>
  );
}

/** A verse typed as «٢:٢٥٥» or «2:255», read in either digits; anything else is not one. */
function verseKeyOf(raw: string): string | null {
  const m = /^\s*([0-9٠-٩]{1,3})\s*:\s*([0-9٠-٩]{1,3})\s*$/.exec(raw);
  if (!m) return null;
  const digits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  return `${Number(digits(m[1]))}:${Number(digits(m[2]))}`;
}

/**
 * Choosing what a comment quotes (B41): a verse by its reference, or a verse or an article already on the map — the
 * card the comment is on first. Only the reference is taken; the words are drawn from the dataset.
 */
function QuotePicker({ tools, anchor, onPick, onCancel }: { tools?: CanvasTools; anchor?: GraphNode | null; onPick: (q: Quote) => void; onCancel: () => void }) {
  const t = useTranslations("graph");
  const id = useId();
  const [ref, setRef] = useState("");
  const [bad, setBad] = useState(false);
  const quotable = (n: GraphNode): Quote | null => (n.data.kind === "verse" && n.data.verse ? { kind: "verse", key: n.data.verse.key } : n.data.kind === "note" && n.data.entry != null ? { kind: "entry", id: n.data.entry } : null);
  const cards = tools ? [...(anchor ? [anchor] : []), ...tools.nodes.filter((n) => n.id !== anchor?.id)].flatMap((n) => { const q = quotable(n); return q ? [{ n, q }] : []; }).slice(0, 8) : [];
  function attach() {
    const key = verseKeyOf(ref);
    if (!key) return setBad(true);
    onPick({ kind: "verse", key });
  }
  return (
    <div className="quote-picker" role="group" aria-label={t("quoteAdd")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <label htmlFor={`${id}-ref`} className="text-[11.5px] text-t3">{t("quoteVerseLabel")}</label>
        <input
          id={`${id}-ref`}
          className="field-input w-24 text-[12.5px]"
          value={ref}
          dir="ltr"
          inputMode="numeric"
          placeholder={t("quoteVersePlaceholder")}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? `${id}-bad` : undefined}
          onChange={(e) => {
            setRef(e.target.value);
            setBad(false);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              attach();
            } else if (e.key === "Escape") onCancel();
          }}
        />
        <button type="button" className="btn text-[12px]" onClick={attach}>{t("quoteAttach")}</button>
        <button type="button" className="comment-act text-[11.5px]" onClick={onCancel}>{t("cancel")}</button>
      </div>
      {bad && <p id={`${id}-bad`} className="text-[11.5px] text-bad">{t("quoteVerseBad")}</p>}
      {cards.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[11.5px] text-t3">{t("quoteFromMap")}</p>
          <ul className="flex flex-wrap gap-1.5">
            {cards.map(({ n, q }) => (
              <li key={n.id}>
                <button type="button" className="chip text-[12px]" onClick={() => onPick(q)}>
                  <span className="text-t3">{t(META[n.data.kind].label)}</span> <span lang="ar">{tools!.cardName(n.id)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-t3">{t("quoteHint")}</p>
    </div>
  );
}
