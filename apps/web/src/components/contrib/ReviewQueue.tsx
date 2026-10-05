"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/store";
import { useIsClient } from "@/lib/client";
import { blockAccount, decide, FILTERS, type Filter, getProposal, getQueue, PAGE, type ProposalDetail, type ProposalOut, report, resolveReport, revert, revise, type Source, withdraw } from "@/lib/contrib";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { useRefusal } from "./refusal";
import { checkable, fromSources, SourceFields, toSources, verseOk } from "./SourceFields";

const settledFilter = (s: ProposalOut["status"]): Filter => (s === "merged" ? "merged" : s === "changes" ? "changes" : s === "approved" ? "approved" : s === "open" ? "open" : "declined");
const NEEDS_SOURCE = new Set<ProposalOut["kind"]>(["edit", "sense", "gloss"]);

/** Who proposed or decided, as the reader sees them: themselves, the name they chose, a contributor without one, a
 * former contributor once the account is gone — in an isolated run, so a name's direction never turns its line. */
function useWho() {
  const t = useTranslations("contrib");
  const tw = useTranslations("wordContrib");
  function who(x: { name: string | null; mine: boolean; former?: boolean }, fallback: "aContributor" | "aReviewer" = "aContributor") {
    return x.mine ? t("you") : x.name ? <bdi>{x.name}</bdi> : x.former ? tw("former") : t(fallback);
  }
  return who;
}

/** A quotation in the interface's own marks: «…» in Arabic, “…” in English (audit 12 F24). */
const quoted = (s: string, locale: string) => (locale === "ar" ? `«${s}»` : `“${s}”`);

/**
 * The review queue (06 §6.3, inventory RVQ-01…81, Q01…Q11; P7.2): proposals by filter with their counts, a list and
 * the selected proposal — what it changes, why, from which sources, who proposed it and who approved it so far —
 * and the reviewer's decision with a note. Two distinct approvals, one of them the editorial board's, merge; the
 * server and the database enforce it, the screen only says it. Deciding moves the selection on (RVQ-44…46), a
 * filter never opens on an empty pane, the address holds the filter and the proposal, and everything is read again
 * when the reader comes back to the tab (P7.5, audit 12 F1, F2, F6, F25, F27).
 */
export function ReviewQueue({ initialFilter, initialId }: { initialFilter: Filter; initialId: string | null }) {
  const t = useTranslations("contrib");
  const locale = useLocale();
  const client = useIsClient();
  const session = useAccount((s) => s.session);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [selected, setSelected] = useState<string | null>(initialId);
  const [phoneDetail, setPhoneDetail] = useState(!!initialId);
  // what a screen reader is told after a decision and on a phone's switches; focus goes with it (F27)
  const [said, setSaid] = useState("");
  const [focusDetail, setFocusDetail] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const signedOutMine = filter === "mine" && !session;
  const q = useInfiniteQuery({
    queryKey: ["queue", filter, session],
    queryFn: ({ pageParam }) => getQueue(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.more ? last.data.at(-1)?.created_at : undefined),
    enabled: client && !signedOutMine,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
  const list = q.data?.pages.flatMap((p) => p.data) ?? [];
  const counts = q.data?.pages[0]?.counts;
  // the pane is never empty while the filter has something (06 §6.3): the first item, until the reader chooses
  const current = selected && (list.some((p) => p.id === selected) || selected === initialId) ? selected : (list[0]?.id ?? null);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (filter !== "open") qs.set("filter", filter);
    if (current) qs.set("id", current);
    window.history.replaceState(null, "", `${window.location.pathname}${qs.size ? `?${qs}` : ""}`);
  }, [filter, current]);

  function choose(f: Filter) {
    setFilter(f);
    setSelected(null); // RVQ-12: the first item of the new filter
    setPhoneDetail(false);
  }

  function open(id: string) {
    setSelected(id);
    setPhoneDetail(true);
    setFocusDetail((n) => n + 1);
  }

  function back() {
    setPhoneDetail(false);
    // back to the row the reader came from
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>("[aria-current=true]")?.focus());
  }

  /** After a decision: the next item in this filter, or — when none is left — the filter the item went to (RVQ-44,
   * 45). The list is read afresh first: the cached one still holds the item just decided (F2). */
  async function decided(p: ProposalDetail, what: string) {
    await qc.invalidateQueries({ queryKey: ["queue"] });
    void qc.invalidateQueries({ queryKey: ["my-proposals"] });
    void qc.invalidateQueries({ queryKey: ["lemma-contrib", p.lemma] });
    void qc.invalidateQueries({ queryKey: ["changelog"] });
    const fresh = await qc.fetchQuery({ queryKey: ["queue-head", filter, session], queryFn: () => getQueue(filter), staleTime: 0 });
    let next: string | null;
    let moved: Filter | null = null;
    if (fresh.data.some((x) => x.id === p.id)) next = p.id; // still here (one approval of two, RVQ-46)
    else {
      const i = list.findIndex((x) => x.id === p.id);
      next = fresh.data[Math.min(Math.max(i, 0), fresh.data.length - 1)]?.id ?? null;
      if (!next) {
        moved = settledFilter(p.status);
        next = p.id;
      }
    }
    if (moved) setFilter(moved);
    setSelected(next);
    setSaid(moved ? t("saidMoved", { what, filter: t(`filter.${moved}`) }) : next === p.id ? what : t("saidNext", { what }));
    setFocusDetail((n) => n + 1);
  }

  const loading = !client || (q.isPending && !signedOutMine);
  return (
    <div className="queue-screen">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold">{t("title")}</h1>
        {counts && (
          <span className="mono text-[12px] text-t3">
            {t("meta", { open: formatNumber(counts.open, locale), mine: formatNumber(counts.mine, locale) })}
          </span>
        )}
      </div>
      <div className="profile-tabs" role="group" aria-label={t("filters")}>
        {FILTERS.filter((f) => f !== "mine" || !!session).map((f) => (
          <button key={f} type="button" className="seg" aria-pressed={filter === f} onClick={() => choose(f)}>
            {t(`filter.${f}`)}
            {counts && counts[f] > 0 && <span className="ms-1.5 mono text-[11px] text-t3">{formatNumber(counts[f], locale)}</span>}
          </button>
        ))}
      </div>
      <p className="sr-only" role="status">
        {said}
      </p>
      <div className={"queue-body" + (phoneDetail ? " show-detail" : "")}>
        <div className="queue-list" aria-label={t(`filter.${filter}`)} role="region" ref={listRef}>
          {signedOutMine ? (
            <p className="p-3 text-[13px] leading-relaxed text-t2">
              {t("mineSignedOut")}{" "}
              <Link href={`/signin?next=${encodeURIComponent("/review?filter=mine")}`} className="underline">
                {t("signIn")}
              </Link>
            </p>
          ) : loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />
          ) : q.isError ? (
            <p className="p-3 text-[13px] text-bad" role="alert">
              {t("failed")}
            </p>
          ) : list.length === 0 ? (
            <p className="p-3 text-[13px] leading-relaxed text-t2">{t(`empty.${filter}`)}</p>
          ) : (
            <>
              <ul className="flex flex-col">
                {list.map((p) => (
                  <QueueRow key={p.id} p={p} on={p.id === current} onOpen={() => open(p.id)} />
                ))}
              </ul>
              {q.hasNextPage && (
                <button type="button" className="btn m-2 self-start" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                  {t("older", cnt(PAGE, locale))}
                </button>
              )}
            </>
          )}
        </div>
        <div className="queue-detail">
          <button type="button" className="btn queue-back min-h-[40px] self-start" onClick={back}>
            {t("back")}
          </button>
          {/* keyed: a note, an error or a revision belongs to its proposal and never travels to the next (F1) */}
          {current ? <Detail key={current} id={current} focusKey={focusDetail} onDecided={decided} /> : !loading && <p className="p-4 text-[13px] text-t3">{t("selectOne")}</p>}
        </div>
      </div>
      <p className="profile-credit">
        {t("footer")}{" "}
        <Link href="/review/guidelines" className="underline">
          {t("guidelinesLink")}
        </Link>
      </p>
    </div>
  );
}

function QueueRow({ p, on, onOpen }: { p: ProposalOut; on: boolean; onOpen: () => void }) {
  const t = useTranslations("contrib");
  const locale = useLocale();
  const who = useWho();
  // a meaning with nothing a reviewer can check cannot be approved: the row says so before it is opened (F21)
  const blocked = NEEDS_SOURCE.has(p.kind) && !p.has_source;
  return (
    <li>
      <button type="button" className={"queue-row" + (on ? " is-on" : "")} aria-current={on ? "true" : undefined} onClick={onOpen}>
        <span className="flex items-baseline gap-2">
          <span className="ar-classical text-[19px] leading-tight" lang="ar" dir="rtl">
            {p.lemma_ar || "—"}
          </span>
          <span className="text-[12px] text-t2">{t(`kind.${p.kind}`)}</span>
          <span className="flex-1" />
          <span className="text-[11px] text-t3">{age(p.created_at, locale, t)}</span>
        </span>
        <span className={"text-[11.5px] " + (blocked ? "text-amber" : "text-t3")}>
          {who(p.proposer)} • {t("approvalsOf", { n: formatNumber(p.approvals, locale) })}
          {p.sources.length ? ` • ${t("cites", cnt(p.sources.length, locale))}` : ""}
          {blocked ? ` • ${t("noCheckableSource")}` : !p.sources.length ? ` • ${t("noSource")}` : ""}
        </span>
      </button>
    </li>
  );
}

function age(iso: string, locale: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days < 1 ? t("today") : t("daysAgo", cnt(days, locale));
}

function Detail({ id, focusKey, onDecided }: { id: string; focusKey: number; onDecided: (p: ProposalDetail, what: string) => void }) {
  const t = useTranslations("contrib");
  const tr = useTranslations("rd");
  const locale = useLocale();
  const session = useAccount((s) => s.session);
  const qc = useQueryClient();
  const refusal = useRefusal();
  const who = useWho();
  const q = useQuery({ queryKey: ["proposal", id, session], queryFn: () => getProposal(id), staleTime: 5_000, refetchOnWindowFocus: true });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState<"withdraw" | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const p = q.data;
  useEffect(() => {
    if (focusKey && p) heading.current?.focus();
  }, [focusKey, p]);
  if (q.isPending) return <div className="h-60 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!p)
    return (
      <p className="p-4 text-[13px] text-bad" role="alert">
        {t("missing")}
      </p>
    );
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  const approvals = p.decisions.filter((d) => d.revision === p.revision && d.decision === "approve");
  // the board's approval merges: one already given, or this reviewer's own (the server's word on their role)
  const board = approvals.some((d) => d.board) || !!p.viewer?.board;
  const willMerge = p.approvals + 1 >= 2 && board;
  const live = p.status === "open" || p.status === "approved";

  async function act(fn: () => Promise<ProposalDetail>, what: string) {
    setBusy(true);
    setError(null);
    try {
      const out = await fn();
      qc.setQueryData(["proposal", id, session], out);
      setNote("");
      onDecided(out, what);
    } catch (e) {
      setError(refusal(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col gap-4" aria-labelledby="proposal-title">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="proposal-title" ref={heading} tabIndex={-1} className="text-[16px] font-semibold outline-none">
            {t(`kind.${p.kind}`)}
            {p.sense_ordinal ? ` ${formatNumber(p.sense_ordinal, locale).padStart(2, locale === "ar" ? "٠" : "0")}` : ""} •{" "}
            <Link href={p.kind === "correction" ? (p.target_href ?? "/review") : `/read?w=${encodeURIComponent(p.lemma)}`} className="ar-classical text-[19px] text-word" lang="ar">
              {p.lemma_ar}
            </Link>
          </h2>
          <p className="text-[12.5px] text-t3">
            {t.rich("byLine", { name: () => who(p.proposer), date: date(p.created_at) })}
            {p.revision > 1 && ` • ${t("revision", { n: formatNumber(p.revision, locale) })}`}
            {p.location && ` • ${p.kind === "correction" ? t("narratorAt", { n: formatNumber(Number(p.location), locale) }) : verseRef(p.location, locale)}`}
            {p.field && ` • ${p.kind === "correction" ? t(`correctionField.${p.field}`) : tr(p.field)}`}
            {p.proposer.mine && live && ` • ${t("notYours")}`}
          </p>
        </div>
        {/* the approval tracker (RVQ-25): two slots, and which of them is the board's */}
        <div className="approval-tracker" role="group" aria-label={t("tracker", { n: formatNumber(p.approvals, locale) })}>
          {[0, 1].map((i) => {
            const a = approvals[i];
            return (
              <span key={i} className={"approval-slot" + (a ? " is-filled" : "")}>
                <span className="approval-dot" aria-hidden="true">
                  {a ? "✓" : ""}
                </span>
                <span className="text-[11px]">
                  {a ? who(a, "aReviewer") : t("pending")}
                  {a?.board ? ` • ${t("board")}` : ""}
                </span>
              </span>
            );
          })}
        </div>
      </div>
      <div className="diff-box">
        {/* the direction of each line is its text's, never the hidden label's (F20) */}
        {p.current_text && p.kind !== "attest" && (
          <p className="diff-line is-before">
            <span className="mono" aria-hidden="true">
              −
            </span>
            <span className="sr-only">{t("before")}</span>
            <bdi dir="auto">{p.current_text}</bdi>
          </p>
        )}
        <p className="diff-line is-after">
          <span className="mono" aria-hidden="true">
            +
          </span>
          <span className="sr-only">{t("after")}</span>
          <bdi dir="auto">{p.text}</bdi>
        </p>
      </div>
      <section className="flex flex-col gap-1.5" aria-labelledby="why-title">
        <h3 id="why-title" className="label-caps">
          {t("whyTitle")}
        </h3>
        <p className="text-[13.5px] leading-relaxed" dir="auto">
          {p.why || t("noWhy")}
        </p>
        <SourcesNote sources={p.sources} has={p.has_source} kind={p.kind} />
      </section>
      <Settled p={p} onDone={onDecided} />
      {p.can.revise && <ReviseForm p={p} onDone={onDecided} />}
      {(p.can.approve || p.can.decline || p.can.changes) && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="label-caps">{t("noteLabel")}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="field" placeholder={t("notePlaceholder")} dir="auto" />
          </label>
          <div className="flex flex-wrap gap-2">
            {p.can.decline && (
              <button type="button" className="btn min-h-[40px] text-bad" disabled={busy} onClick={() => void act(() => decide(p.id, "decline", note), t("saidDeclined"))}>
                {t("decline")}
              </button>
            )}
            {p.can.changes && (
              <button type="button" className="btn min-h-[40px]" disabled={busy} onClick={() => void act(() => decide(p.id, "changes", note), t("saidChanges"))}>
                {t("requestChanges")}
              </button>
            )}
            <span className="flex-1" />
            {p.approved_by_me ? (
              <span className="self-center text-[12.5px] text-good">{t("youApproved")}</span>
            ) : p.waiting_board ? (
              <span className="self-center text-[12.5px] text-t3">{t("approvedWaiting")}</span>
            ) : (
              <button type="button" className="btn btn-primary min-h-[40px]" disabled={busy || !p.can.approve} onClick={() => void act(() => decide(p.id, "approve", note), willMerge ? t("saidMerged") : t("saidApproved"))}>
                {willMerge ? t("approveMerge") : t("approveOf", { n: formatNumber(p.approvals + 1, locale) })}
              </button>
            )}
          </div>
        </div>
      )}
      {!session && live && <p className="text-[12.5px] text-t3">{t("signInToReview")}</p>}
      {error && (
        <p className="text-[12.5px] text-bad" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {p.can.withdraw &&
          (sure === "withdraw" ? (
            <>
              <button type="button" className="btn btn-danger min-h-[40px]" disabled={busy} autoFocus onClick={() => void act(() => withdraw(p.id), t("saidWithdrawn"))}>
                {t("withdrawSure")}
              </button>
              <button type="button" className="btn min-h-[40px]" onClick={() => setSure(null)}>
                {t("cancel")}
              </button>
            </>
          ) : (
            <button type="button" className="btn min-h-[40px]" disabled={busy} onClick={() => setSure("withdraw")}>
              {t("withdraw")}
            </button>
          ))}
        {p.can.report && <ReportButton id={p.id} />}
      </div>
      {(p.reports?.length ?? 0) > 0 && <Reports p={p} onDone={(out) => qc.setQueryData(["proposal", id, session], out)} />}
      {p.can.block && <BlockButton p={p} onDone={() => void q.refetch()} />}
      {p.decisions.length > 0 && (
        <section aria-labelledby="decisions-title" className="flex flex-col gap-1.5">
          <h3 id="decisions-title" className="label-caps">
            {t("history")}
          </h3>
          <ol className="flex flex-col gap-1 text-[12.5px] text-t2">
            {p.decisions.map((d, i) => (
              <li key={i}>
                {t(`decision.${d.decision}`)} • {who(d, "aReviewer")}
                {d.board ? ` (${t("board")})` : ""} • {date(d.at)}
                {p.revision > 1 ? ` • ${t("revision", { n: formatNumber(d.revision, locale) })}` : ""}
                {d.note ? (
                  <>
                    {" — "}
                    <bdi dir="auto">{quoted(d.note, locale)}</bdi>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

function SourcesNote({ sources, has, kind }: { sources: Source[]; has: boolean; kind: ProposalOut["kind"] }) {
  const t = useTranslations("contrib");
  const locale = useLocale();
  if (!sources.length) return <p className="text-[12.5px] text-amber">{NEEDS_SOURCE.has(kind) ? t("noSourceBlocks") : t("noSourceAttached")}</p>;
  const name = (s: Source) => (s.work === "quran" ? t("quranSource") : s.work === "grammar" ? t("grammar") : s.work === "other" ? t("other") : ((locale === "ar" ? s.title_ar : s.title_en) ?? s.work));
  return (
    <p className={"text-[12.5px] " + (has ? "text-good" : "text-amber")}>
      {t("cited")}: {sources.map((s) => `${name(s)}${s.ref ? ` — ${s.work === "quran" ? verseRef(s.ref, locale) : s.ref}` : ""}`).join(locale === "ar" ? "؛ " : "; ")}
      {!has && NEEDS_SOURCE.has(kind) && ` • ${t("noCheckableSource")}`}
    </p>
  );
}

/** The settled banner (RVQ-33…35): merged and credited, taken back, declined or changes requested with the note,
 * withdrawn. Taking a merge back is asked twice (F8). */
function Settled({ p, onDone }: { p: ProposalDetail; onDone: (p: ProposalDetail, what: string) => void }) {
  const t = useTranslations("contrib");
  const locale = useLocale();
  const refusal = useRefusal();
  const who = useWho();
  const [note, setNote] = useState("");
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (p.status === "open") return null;
  if (p.status === "approved") return <p className="settled-banner">{t("approvedWaiting")}</p>;
  if ((p.status === "merged" || p.status === "reverted") && p.merge)
    return (
      <div className="settled-banner is-merged">
        <p>
          {p.merge.reverted_at ? (
            <>
              {t("revertedBy")}
              {p.merge.revert_note && (
                <>
                  {" — "}
                  <bdi dir="auto">{quoted(p.merge.revert_note, locale)}</bdi>
                </>
              )}
            </>
          ) : (
            t.rich("mergedCredit", { name: () => who(p.proposer) })
          )}
        </p>
        {p.can.revert && (
          <div className="flex flex-wrap gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} className="field min-h-[40px] flex-1" placeholder={t("revertNote")} aria-label={t("revertNote")} dir="auto" />
            {sure ? (
              <>
                <button
                  type="button"
                  className="btn btn-danger min-h-[40px]"
                  autoFocus
                  onClick={() =>
                    void revert(p.merge!.id, note)
                      .then((out) => onDone(out, t("saidReverted")))
                      .catch((e) => setError(refusal(e)))
                  }
                >
                  {t("revertSure")}
                </button>
                <button type="button" className="btn min-h-[40px]" onClick={() => setSure(false)}>
                  {t("cancel")}
                </button>
              </>
            ) : (
              <button type="button" className="btn min-h-[40px] text-bad" onClick={() => setSure(true)}>
                {t("revert")}
              </button>
            )}
          </div>
        )}
        {error && (
          <p className="text-[12.5px] text-bad" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  const key = p.status === "changes" ? "changesRequested" : p.status === "withdrawn" ? "withdrawn" : "declined";
  return (
    <p className="settled-banner">
      {t(key)}
      {p.note ? (
        <>
          {" — "}
          <bdi dir="auto">{quoted(p.note, locale)}</bdi>
        </>
      ) : null}
    </p>
  );
}

/** Changes requested: the proposer answers with a new revision, with the same source fields as the proposal form,
 * so a meaning sent back for a source can be approved (RVQ-42; audit 12 F3). */
function ReviseForm({ p, onDone }: { p: ProposalDetail; onDone: (p: ProposalDetail, what: string) => void }) {
  const t = useTranslations("contrib");
  const refusal = useRefusal();
  const [text, setText] = useState(p.text);
  const [why, setWhy] = useState(p.why);
  const [draft, setDraft] = useState(() => fromSources(p.sources));
  const [error, setError] = useState<string | null>(null);
  const sources = toSources(draft);
  const ok = !!text.trim() && !!why.trim() && verseOk(draft.verse);
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void revise(p.id, { text, why, sources })
          .then((out) => onDone(out, t("saidRevised")))
          .catch((err) => setError(refusal(err)));
      }}
    >
      <p className="text-[13px] font-medium">{t("reviseTitle")}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="field" aria-label={t("after")} dir="auto" />
      <input value={why} onChange={(e) => setWhy(e.target.value)} className="field min-h-[40px]" aria-label={t("whyTitle")} dir="auto" />
      <SourceFields draft={draft} onChange={setDraft} needsSource={NEEDS_SOURCE.has(p.kind)} />
      {error && (
        <p className="text-[12.5px] text-bad" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary min-h-[40px] self-start" disabled={!ok}>
        {t("resubmit")}
      </button>
      {NEEDS_SOURCE.has(p.kind) && !checkable(sources) && <p className="text-[11.5px] text-t3">{t("resubmitWithoutSource")}</p>}
    </form>
  );
}

function ReportButton({ id }: { id: string }) {
  const t = useTranslations("contrib");
  const refusal = useRefusal();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (done)
    return (
      <span className="self-center text-[12.5px] text-t3" role="status">
        {t("reported")}
      </span>
    );
  if (!open)
    return (
      <button type="button" className="btn min-h-[40px]" onClick={() => setOpen(true)}>
        {t("report")}
      </button>
    );
  return (
    <form
      className="flex flex-1 flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        void report(id, reason)
          .then(() => setDone(true))
          .catch((err) => setError(refusal(err)));
      }}
    >
      <input value={reason} onChange={(e) => setReason(e.target.value)} className="field min-h-[40px] flex-1" placeholder={t("reportReason")} aria-label={t("reportReason")} dir="auto" autoFocus />
      <button type="submit" className="btn min-h-[40px]" disabled={!reason.trim()}>
        {t("send")}
      </button>
      {error && (
        <p className="w-full text-[12.5px] text-bad" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/** What readers reported, for the board: each with its reason, dismissed or acted on, and what came of it (RVQ-74). */
function Reports({ p, onDone }: { p: ProposalDetail; onDone: (p: ProposalDetail) => void }) {
  const t = useTranslations("contrib");
  const locale = useLocale();
  const refusal = useRefusal();
  const [error, setError] = useState<string | null>(null);
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long" }).format(new Date(iso));
  const resolve = (rid: number, outcome: "dismissed" | "acted") =>
    void resolveReport(rid, outcome, "")
      .then(onDone)
      .catch((e) => setError(refusal(e)));
  return (
    <section className="flex flex-col gap-1.5 rounded-xl border border-line p-3" aria-labelledby="reports-title">
      <h3 id="reports-title" className="label-caps">
        {t("reportsTitle", cnt(p.reports!.length, locale))}
      </h3>
      <ul className="flex flex-col gap-2">
        {p.reports!.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="flex-1">
              <bdi dir="auto">{quoted(r.reason, locale)}</bdi> • {date(r.at)}
            </span>
            {r.resolved_at ? (
              <span className="text-t3">{t(`reportOutcome.${r.outcome ?? "dismissed"}`)}</span>
            ) : (
              <>
                <button type="button" className="btn min-h-[40px]" aria-label={t("reportDismissNamed", { reason: r.reason })} onClick={() => resolve(r.id, "dismissed")}>
                  {t("reportDismiss")}
                </button>
                <button type="button" className="btn min-h-[40px]" aria-label={t("reportActedNamed", { reason: r.reason })} onClick={() => resolve(r.id, "acted")}>
                  {t("reportActed")}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="text-[12.5px] text-bad" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** An administrator stops the proposer's account proposing, reviewing and reporting — or lets it again; asked twice. */
function BlockButton({ p, onDone }: { p: ProposalDetail; onDone: () => void }) {
  const t = useTranslations("contrib");
  const refusal = useRefusal();
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = !!p.proposer_blocked;
  const go = () =>
    void blockAccount(p.id, !blocked)
      .then(() => (setSure(false), onDone()))
      .catch((e) => setError(refusal(e)));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {blocked && <span className="text-[12.5px] text-bad">{t("proposerBlocked")}</span>}
      {sure ? (
        <>
          <button type="button" className={"btn min-h-[40px] " + (blocked ? "" : "btn-danger")} autoFocus onClick={go}>
            {blocked ? t("unblockSure") : t("blockSure")}
          </button>
          <button type="button" className="btn min-h-[40px]" onClick={() => setSure(false)}>
            {t("cancel")}
          </button>
        </>
      ) : (
        <button type="button" className="btn min-h-[40px]" onClick={() => setSure(true)}>
          {blocked ? t("unblock") : t("block")}
        </button>
      )}
      {error && (
        <p className="w-full text-[12.5px] text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
