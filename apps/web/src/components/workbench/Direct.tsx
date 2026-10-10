"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useAccount } from "@/lib/account/store";
import { decideEntry, discardEntry, getEntry, publishEntry, reviewPublished, saveEntry, submitEntry, type Entry, type EntryPage, type Kind, type Source } from "@/lib/editorial";
import { formatNumber } from "@/lib/format";
import { useWorkbenchRefusal } from "./refusal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Value = any;

/**
 * The work on one target of the administration's kinds (P14, D31): the page, the value as it is being written (the
 * open draft, else what is in force, else the tool's first value), and the life of the work — saved, published by an
 * administrator at once, or sent by an editor to the board's two-person review; in force by the administration or the
 * board, and reviewed by the board after.
 */
export function useDirect(kind: Kind, target: string, first: (page: EntryPage) => Value) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["editorial-entry", kind, target], queryFn: () => getEntry(kind, target), refetchOnWindowFocus: false });
  const [draft, setDraft] = useState<{ value: Value; sources: Source[] } | null>(null);
  const page = q.data;
  const open = page?.open ?? null;
  const value: Value = draft?.value ?? open?.value ?? page?.in_force?.value ?? (page ? first(page) : null);
  const sources: Source[] = draft?.sources ?? open?.sources ?? page?.in_force?.sources ?? [];
  const refresh = async () => {
    setDraft(null);
    await qc.invalidateQueries({ queryKey: ["editorial-entry", kind, target] });
    for (const k of ["editorial-worklists", "editorial-targets", "editorial-awaiting", "editorial-overview"]) void qc.invalidateQueries({ queryKey: [k] });
  };
  return {
    q,
    page,
    open,
    value,
    sources,
    dirty: !!draft,
    setValue: (v: Value) => setDraft({ value: v, sources }),
    setSources: (s: Source[]) => setDraft({ value, sources: s }),
    refresh,
  };
}

/** How the revision in force came into force, read from the history: published by the administration (reviewed by the
 * board after, or not yet), or approved by the board. */
export function forceState(page: EntryPage): { by: "administration" | "board"; reviewed: boolean } | null {
  const f = page.in_force;
  if (!f) return null;
  const here = page.history.filter((h) => h.revision === f.revision);
  const published = here.some((h) => h.action === "published");
  return { by: published ? "administration" : "board", reviewed: published && here.some((h) => h.action === "reviewed") };
}

/** Who put the context or the links in force, and whether the board has reviewed them, in the reader's words. */
export function ForceLine({ by, reviewed, at }: { by: "administration" | "board"; reviewed: boolean; at: string | null }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const date = at ? new Date(at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB") : "";
  return (
    <span className="text-[12px] text-t2">
      {t(by === "administration" ? "pubByAdministration" : "pubByBoard", { date })}
      {by === "administration" && <span className={reviewed ? "text-good" : "text-t3"}>{` • ${t(reviewed ? "pubReviewed" : "pubNotReviewed")}`}</span>}
    </span>
  );
}

/**
 * The bar under a tool: what is in force and how; save; publish (administrators) or send to review (editors); the
 * board's review of what the administration published; another editor's decision on an editor's work in review;
 * discard; and the history. Every refusal is said in the reader's language.
 */
export function DirectBar({ kind, target, work, role, canSave = true }: { kind: Kind; target: string; work: ReturnType<typeof useDirect>; role: string; canSave?: boolean }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const me = useAccount((s) => s.user?.id);
  const refusal = useWorkbenchRefusal();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const [note, setNote] = useState("");
  const page = work.page;
  if (!page) return null;
  const open = page.open;
  const force = forceState(page);
  const admin = role === "admin";
  const theirs = !!open && !open.mine;
  const inReview = open?.status === "review";

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setSaid("");
    try {
      await fn();
      setNote("");
      await work.refresh();
      setSaid(done);
    } catch (e) {
      setSaid(refusal(e));
    } finally {
      setBusy(false);
    }
  }
  const save = async (): Promise<Entry> => (work.dirty || !open ? saveEntry(kind, target, work.value, work.sources) : open);
  const reviewable = force?.by === "administration" && !force.reviewed && page.in_force && page.in_force.author.id !== me;

  return (
    <section className="direct-bar" aria-label={t("pubWork")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {page.in_force && force ? <ForceLine by={force.by} reviewed={force.reviewed} at={page.in_force.decided_at} /> : <span className="text-[12px] text-t3">{t("pubNothingInForce")}</span>}
        {open && <span className="text-[12px] text-t3">{t("pubOpen", { status: t(`status_${open.status}`), name: open.mine ? t("you") : (open.author.name ?? t("anEditor")), n: formatNumber(open.revision, locale) })}</span>}
        {work.dirty && <span className="text-[12px] text-amber">{t("pubUnsaved")}</span>}
      </div>
      {theirs && !inReview && <p className="text-[12.5px] text-t2">{t("pubTheirs")}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!theirs && !inReview && canSave && (
          <>
            {admin ? (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act(async () => publishEntry((await save()).id), t("pubSaidPublished"))}>
                {t("pubPublish")}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act(async () => submitEntry((await save()).id), t("saidSubmitted"))}>
                {t("pubSubmit")}
              </button>
            )}
            <button type="button" className="btn" disabled={busy || !work.dirty} onClick={() => void act(() => saveEntry(kind, target, work.value, work.sources), t("saidSaved"))}>
              {t("pubSaveDraft")}
            </button>
          </>
        )}
        {open?.mine && (open.status === "draft" || open.status === "changes") && (
          <button type="button" className="btn" disabled={busy} onClick={() => void act(() => discardEntry(open.id), t("saidDiscarded"))}>
            {t("discard")}
          </button>
        )}
        {open?.mine && inReview && <span className="text-[12.5px] text-t3">{t("waitsOnAnother")}</span>}
      </div>
      {theirs && inReview && (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3" role="group" aria-label={t("review")}>
          <p className="text-[12.5px] text-t2">{t("reviewLead")}</p>
          <textarea className="field-input min-h-[52px]" value={note} onChange={(e) => setNote(e.target.value)} aria-label={t("note")} dir="auto" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act(() => decideEntry(open.id, "approve", note), t("saidApproved"))}>{t("approve")}</button>
            <button type="button" className="btn" disabled={busy || !note.trim()} onClick={() => void act(() => decideEntry(open.id, "changes", note), t("saidChanges"))}>{t("askChanges")}</button>
          </div>
        </div>
      )}
      {reviewable && page.in_force && (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3" role="group" aria-label={t("pubBoardReview")}>
          <p className="text-[12.5px] text-t2">{t("pubBoardReviewLead")}</p>
          <textarea className="field-input min-h-[44px]" value={note} onChange={(e) => setNote(e.target.value)} aria-label={t("note")} placeholder={t("pubReviewNote")} dir="auto" />
          <button type="button" className="btn self-start" disabled={busy} onClick={() => void act(() => reviewPublished(page.in_force!.id, note), t("pubSaidReviewed"))}>
            {t("pubMarkReviewed")}
          </button>
        </div>
      )}
      <p className="text-[12.5px] text-t2" role="status" aria-live="polite">{said}</p>
      {page.history.length > 0 && (
        <details className="text-[12px] text-t3">
          <summary className="cursor-pointer">{t("history")}</summary>
          <ol className="mt-1 flex flex-col gap-0.5">
            {page.history.map((h, i) => (
              <li key={i}>
                {t(`action_${h.action}`, { name: h.by ?? t("anEditor"), n: formatNumber(h.revision, locale) })} • {new Date(h.at).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB")}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
