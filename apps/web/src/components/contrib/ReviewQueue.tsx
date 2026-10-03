"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { ApiError, useAccount } from "@/lib/account/store";
import { useIsClient } from "@/lib/client";
import { decide, FILTERS, type Filter, getProposal, getQueue, type ProposalDetail, type ProposalOut, report, revert, revise, type Source, withdraw } from "@/lib/contrib";
import { cnt, formatNumber } from "@/lib/format";

const settledFilter = (s: ProposalOut["status"]): Filter => (s === "merged" ? "merged" : s === "changes" ? "changes" : s === "approved" ? "approved" : s === "open" ? "open" : "declined");

/**
 * The review queue (06 §6.3, inventory RVQ-01…81, Q01…Q11; P7.2): proposals by filter with their counts, a list and
 * the selected proposal — what it changes, why, from which sources, who proposed it and who approved it so far —
 * and the reviewer's decision with a note. Two distinct approvals, one of them the editorial board's, merge; the
 * server and the database enforce it, the screen only says it. Deciding moves the selection on (RVQ-44…46), a
 * filter never opens on an empty pane, and the address holds the filter and the proposal.
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
  const q = useQuery({ queryKey: ["queue", filter, session], queryFn: () => getQueue(filter), enabled: client && (filter !== "mine" || !!session) });
  const list = q.data?.data ?? [];
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

  /** After a decision: the next item in this filter, or — when none is left — the filter the item went to (RVQ-44, 45). */
  async function decided(p: ProposalDetail) {
    const fresh = await qc.fetchQuery({ queryKey: ["queue", filter, session], queryFn: () => getQueue(filter) });
    void qc.invalidateQueries({ queryKey: ["queue"] });
    if (fresh.data.some((x) => x.id === p.id)) return setSelected(p.id); // still here (one approval of two, RVQ-46)
    const i = list.findIndex((x) => x.id === p.id);
    const next = fresh.data[Math.min(Math.max(i, 0), fresh.data.length - 1)];
    if (next) return setSelected(next.id);
    setFilter(settledFilter(p.status));
    setSelected(p.id);
  }

  const counts = q.data?.counts;
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
      <div className={"queue-body" + (phoneDetail ? " show-detail" : "")}>
        <div className="queue-list" aria-label={t(`filter.${filter}`)} role="region">
          {q.isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />
          ) : q.isError ? (
            <p className="p-3 text-[13px] text-bad" role="alert">
              {t("failed")}
            </p>
          ) : list.length === 0 ? (
            <p className="p-3 text-[13px] leading-relaxed text-t2">{t(`empty.${filter}`)}</p>
          ) : (
            <ul className="flex flex-col">
              {list.map((p) => (
                <li key={p.id}>
                  <button type="button" className={"queue-row" + (p.id === current ? " is-on" : "")} aria-current={p.id === current ? "true" : undefined} onClick={() => (setSelected(p.id), setPhoneDetail(true))}>
                    <span className="flex items-baseline gap-2">
                      <span className="ar-classical text-[19px] leading-tight" lang="ar" dir="rtl">
                        {p.lemma_ar || "—"}
                      </span>
                      <span className="text-[12px] text-t2">{t(`kind.${p.kind}`)}</span>
                      <span className="flex-1" />
                      <span className="text-[11px] text-t3">{age(p.created_at, locale, t)}</span>
                    </span>
                    <span className={"text-[11.5px] " + (!p.has_source && !p.why ? "text-amber" : "text-t3")}>
                      {p.proposer.mine ? t("you") : (p.proposer.name ?? t("aContributor"))} • {t("approvalsOf", { n: formatNumber(p.approvals, locale) })}
                      {p.sources.length ? ` • ${t("cites", cnt(p.sources.length, locale))}` : ` • ${t("noSource")}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="queue-detail">
          <button type="button" className="btn queue-back min-h-[40px] self-start" onClick={() => setPhoneDetail(false)}>
            {t("back")}
          </button>
          {current ? <Detail id={current} onDecided={decided} /> : <p className="p-4 text-[13px] text-t3">{t("selectOne")}</p>}
        </div>
      </div>
      <p className="profile-credit">{t("footer")}</p>
    </div>
  );
}

function age(iso: string, locale: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days < 1 ? t("today") : t("daysAgo", cnt(days, locale));
}

function Detail({ id, onDecided }: { id: string; onDecided: (p: ProposalDetail) => void }) {
  const t = useTranslations("contrib");
  const tr = useTranslations("rd");
  const locale = useLocale();
  const session = useAccount((s) => s.session);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["proposal", id, session], queryFn: () => getProposal(id) });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = q.data;
  if (q.isLoading) return <div className="h-60 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
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

  async function act(fn: () => Promise<ProposalDetail>) {
    setBusy(true);
    setError(null);
    try {
      const out = await fn();
      qc.setQueryData(["proposal", id, session], out);
      setNote("");
      onDecided(out);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col gap-4" aria-labelledby="proposal-title">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="proposal-title" className="text-[16px] font-semibold">
            {t(`kind.${p.kind}`)}
            {p.sense_ordinal ? ` ${formatNumber(p.sense_ordinal, locale).padStart(2, locale === "ar" ? "٠" : "0")}` : ""} •{" "}
            <Link href={`/read?w=${encodeURIComponent(p.lemma)}`} className="ar-classical text-[19px] text-word" lang="ar">
              {p.lemma_ar}
            </Link>
          </h2>
          <p className="text-[12.5px] text-t3">
            {t("byLine", { name: p.proposer.mine ? t("you") : (p.proposer.name ?? t("aContributor")), date: date(p.created_at) })}
            {p.revision > 1 && ` • ${t("revision", { n: formatNumber(p.revision, locale) })}`}
            {p.location && ` • ${p.location}`}
            {p.field && ` • ${tr(p.field)}`}
            {p.proposer.mine && live && ` • ${t("notYours")}`}
          </p>
        </div>
        {/* the approval tracker (RVQ-25): two slots, and which of them is the board's */}
        <div className="approval-tracker" aria-label={t("tracker", { n: formatNumber(p.approvals, locale) })}>
          {[0, 1].map((i) => {
            const a = approvals[i];
            return (
              <span key={i} className={"approval-slot" + (a ? " is-filled" : "")}>
                <span className="approval-dot" aria-hidden="true">
                  {a ? "✓" : ""}
                </span>
                <span className="text-[11px]">{a ? `${a.mine ? t("you") : (a.name ?? t("aReviewer"))}${a.board ? ` • ${t("board")}` : ""}` : t("pending")}</span>
              </span>
            );
          })}
        </div>
      </div>
      <div className="diff-box">
        {p.current_text && p.kind !== "attest" && (
          <p className="diff-line is-before" dir="auto">
            <span className="mono" aria-hidden="true">
              −
            </span>
            <span className="sr-only">{t("before")}</span>
            {p.current_text}
          </p>
        )}
        <p className="diff-line is-after" dir="auto">
          <span className="mono" aria-hidden="true">
            +
          </span>
          <span className="sr-only">{t("after")}</span>
          {p.text}
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
              <button type="button" className="btn min-h-[40px] text-bad" disabled={busy} onClick={() => void act(() => decide(p.id, "decline", note))}>
                {t("decline")}
              </button>
            )}
            {p.can.changes && (
              <button type="button" className="btn min-h-[40px]" disabled={busy} onClick={() => void act(() => decide(p.id, "changes", note))}>
                {t("requestChanges")}
              </button>
            )}
            <span className="flex-1" />
            {p.approved_by_me ? (
              <span className="self-center text-[12.5px] text-good">{t("youApproved")}</span>
            ) : (
              <button type="button" className="btn btn-primary min-h-[40px]" disabled={busy || !p.can.approve} onClick={() => void act(() => decide(p.id, "approve", note))}>
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
        {p.can.withdraw && (
          <button type="button" className="btn min-h-[40px]" disabled={busy} onClick={() => void act(() => withdraw(p.id))}>
            {t("withdraw")}
          </button>
        )}
        {p.can.report && <ReportButton id={p.id} />}
      </div>
      {p.decisions.length > 0 && (
        <section aria-labelledby="decisions-title" className="flex flex-col gap-1.5">
          <h3 id="decisions-title" className="label-caps">
            {t("history")}
          </h3>
          <ol className="flex flex-col gap-1 text-[12.5px] text-t2">
            {p.decisions.map((d, i) => (
              <li key={i}>
                {t(`decision.${d.decision}`)} • {d.mine ? t("you") : (d.name ?? t("aReviewer"))}
                {d.board ? ` (${t("board")})` : ""} • {date(d.at)}
                {p.revision > 1 ? ` • ${t("revision", { n: formatNumber(d.revision, locale) })}` : ""}
                {d.note ? ` — «${d.note}»` : ""}
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
  if (!sources.length)
    return <p className="text-[12.5px] text-amber">{kind === "edit" || kind === "sense" || kind === "gloss" ? t("noSourceBlocks") : t("noSourceAttached")}</p>;
  const name = (s: Source) => (s.work === "quran" ? t("quranSource") : s.work === "grammar" ? t("grammar") : s.work === "other" ? t("other") : ((locale === "ar" ? s.title_ar : s.title_en) ?? s.work));
  return (
    <p className={"text-[12.5px] " + (has ? "text-good" : "text-amber")}>
      {t("cited")}: {sources.map((s) => `${name(s)}${s.ref ? ` — ${s.ref}` : ""}`).join("؛ ")}
    </p>
  );
}

/** The settled banner (RVQ-33…35): merged and credited, declined or changes requested with the note, withdrawn. */
function Settled({ p, onDone }: { p: ProposalDetail; onDone: (p: ProposalDetail) => void }) {
  const t = useTranslations("contrib");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (p.status === "open") return null;
  if (p.status === "approved") return <p className="settled-banner">{t("approvedWaiting")}</p>;
  if (p.status === "merged" && p.merge)
    return (
      <div className="settled-banner is-merged">
        <p>
          {p.merge.reverted_at ? t("reverted", { note: p.merge.revert_note ?? "" }) : t("merged", { name: p.proposer.mine ? t("you") : (p.proposer.name ?? t("aContributor")) })}
        </p>
        {p.can.revert && (
          <div className="flex flex-wrap gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} className="field min-h-[40px] flex-1" placeholder={t("revertNote")} aria-label={t("revertNote")} dir="auto" />
            <button
              type="button"
              className="btn min-h-[40px] text-bad"
              onClick={() =>
                void revert(p.merge!.id, note)
                  .then(onDone)
                  .catch((e) => setError(e instanceof ApiError ? e.detail : String(e)))
              }
            >
              {t("revert")}
            </button>
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
      {p.note ? ` • «${p.note}»` : ""}
    </p>
  );
}

/** Changes requested: the proposer answers with a new revision, which goes back to the queue (RVQ-42 fixed). */
function ReviseForm({ p, onDone }: { p: ProposalDetail; onDone: (p: ProposalDetail) => void }) {
  const t = useTranslations("contrib");
  const [text, setText] = useState(p.text);
  const [why, setWhy] = useState(p.why);
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const sources = [...p.sources.map((s) => ({ work: s.work, ref: s.ref })), ...(ref.trim() ? [{ work: "other", ref: ref.trim() }] : [])];
        void revise(p.id, { text, why, sources })
          .then(onDone)
          .catch((err) => setError(err instanceof ApiError ? err.detail : String(err)));
      }}
    >
      <p className="text-[13px] font-medium">{t("reviseTitle")}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="field" aria-label={t("after")} dir="auto" />
      <input value={why} onChange={(e) => setWhy(e.target.value)} className="field min-h-[40px]" aria-label={t("whyTitle")} dir="auto" />
      <input value={ref} onChange={(e) => setRef(e.target.value)} className="field min-h-[40px]" placeholder={t("addSource")} aria-label={t("addSource")} dir="auto" />
      {error && (
        <p className="text-[12.5px] text-bad" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary min-h-[40px] self-start" disabled={!text.trim() || !why.trim()}>
        {t("resubmit")}
      </button>
    </form>
  );
}

function ReportButton({ id }: { id: string }) {
  const t = useTranslations("contrib");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <span className="self-center text-[12.5px] text-t3">{t("reported")}</span>;
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
        void report(id, reason).then(() => setDone(true));
      }}
    >
      <input value={reason} onChange={(e) => setReason(e.target.value)} className="field min-h-[40px] flex-1" placeholder={t("reportReason")} aria-label={t("reportReason")} dir="auto" />
      <button type="submit" className="btn min-h-[40px]" disabled={!reason.trim()}>
        {t("send")}
      </button>
    </form>
  );
}
