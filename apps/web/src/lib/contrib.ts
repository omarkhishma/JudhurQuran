"use client";

import { ApiError, apiError, authFetch, useAccount } from "@/lib/account/store";
import { type CorrectionField, type Proposal as Draft, usePersonal } from "@/lib/reader/store";

/** Contribution and moderation in the browser (PLAN P7): the shapes the API returns and the calls that change them. */
export type Kind = "edit" | "sense" | "gloss" | "morphology" | "error" | "attest" | "entry" | "correction";
/** the kinds a word of the Quran takes (the proposal form's) */
export type WordKind = Exclude<Kind, "correction">;
export type { CorrectionField };
export type Status = "open" | "approved" | "changes" | "merged" | "declined" | "withdrawn" | "reverted";
export type Filter = "open" | "mine" | "approved" | "changes" | "merged" | "declined";
export const FILTERS: Filter[] = ["open", "mine", "approved", "changes", "merged", "declined"];
export type Source = { work: string; ref: string; title_ar?: string | null; title_en?: string | null };
export type ProposalOut = {
  id: string;
  kind: Kind;
  lemma: string;
  lemma_ar: string;
  target_href?: string | null;
  sense_ordinal: number | null;
  location: string | null;
  field: string | null;
  current_text: string;
  text: string;
  why: string;
  sources: Source[];
  has_source: boolean;
  status: Status;
  revision: number;
  note: string | null;
  approvals: number;
  proposer: { name: string | null; mine: boolean; former?: boolean };
  created_at: string;
  updated_at: string;
  decided_at: string | null;
};
export type Decision = { revision: number; decision: "approve" | "decline" | "changes"; note: string | null; board: boolean; name: string | null; mine: boolean; at: string };
export type Report = { id: number; reason: string; at: string; resolved_at: string | null; outcome: "dismissed" | "acted" | null; note: string | null };
export type ProposalDetail = ProposalOut & {
  decisions: Decision[];
  merge: { id: string; merged_at: string; reverted_at: string | null; revert_note: string | null } | null;
  can: { approve: boolean; decline: boolean; changes: boolean; revise: boolean; withdraw: boolean; report: boolean; revert: boolean; block?: boolean };
  approved_by_me: boolean;
  /** two reviewers have approved; the board has not, and a third reviewer's approval would change nothing */
  waiting_board?: boolean;
  /** what readers reported about it — the board's to read (empty for everyone else) */
  reports?: Report[];
  proposer_blocked?: boolean;
  viewer: { role: string; reviewer: boolean; board: boolean } | null;
};
export type Viewer = { role: string; reviewer: boolean; board: boolean } | null;
export type Queue = { data: ProposalOut[]; more: boolean; counts: Record<Filter, number>; viewer: Viewer };
export type Merge = {
  id: string;
  proposal_id: string;
  kind: Kind;
  lemma: string;
  lemma_ar: string;
  target_href?: string | null;
  sense_ordinal: number | null;
  location: string | null;
  field: string | null;
  previous_text: string;
  text: string;
  sources: Source[];
  contributor: string | null;
  former: boolean;
  reviewers: { name: string | null; board: boolean }[];
  merged_at: string;
  reverted_at: string | null;
  /** taken into the board's sense list in force (B38): shown there, credited, not again beside it */
  folded?: boolean;
};
export type ChangelogEntry = { entry: number; at: string; event: "merged" | "reverted"; dataset_version: string; merge: Merge };
export type Changelog = { data: ChangelogEntry[]; more: boolean };

/** Public reads send the session when there is one, so the answer says what this reader may do. */
async function read<T>(path: string): Promise<T> {
  const session = useAccount.getState().session;
  const r = await fetch(`/api/v1${path}`, { headers: session ? { Authorization: `Bearer ${session}` } : {} });
  if (!r.ok) throw await apiError(r, path);
  return (await r.json()) as T;
}

export const getQueue = (f: Filter, before?: string) => read<Queue>(`/proposals?filter=${f}${before ? `&before=${encodeURIComponent(before)}` : ""}`);
export const PAGE = 50;
export const getProposal = (id: string) => read<ProposalDetail>(`/proposals/${id}`);
export const getChangelog = (before?: number) => read<Changelog>(`/changelog${before ? `?before=${before}` : ""}`);
export const getLemmaContributions = (slug: string) => read<{ data: Merge[]; pending: number }>(`/lemmas/${encodeURIComponent(slug)}/contributions`);

export const decide = (id: string, decision: Decision["decision"], note: string) =>
  authFetch<ProposalDetail>(`/proposals/${id}/decisions`, { method: "POST", body: JSON.stringify({ decision, note: note || null }) });
export const revise = (id: string, body: { text: string; why: string; sources: Source[] }) => authFetch<ProposalDetail>(`/proposals/${id}/revise`, { method: "POST", body: JSON.stringify(body) });
export const withdraw = (id: string) => authFetch<ProposalDetail>(`/proposals/${id}/withdraw`, { method: "POST" });
export const report = (id: string, reason: string) => authFetch(`/proposals/${id}/report`, { method: "POST", body: JSON.stringify({ reason }) });
export const revert = (mergeId: string, note: string) => authFetch<ProposalDetail>(`/merges/${mergeId}/revert`, { method: "POST", body: JSON.stringify({ note }) });
export const myProposals = () => authFetch<{ data: ProposalOut[] }>("/me/proposals");
export const resolveReport = (rid: number, outcome: "dismissed" | "acted", note: string) => authFetch<ProposalDetail>(`/reports/${rid}/resolve`, { method: "POST", body: JSON.stringify({ outcome, note: note || null }) });
export const blockAccount = (proposalId: string, blocked: boolean) => authFetch<{ blocked: boolean }>("/admin/block", { method: "POST", body: JSON.stringify({ target: proposalId, blocked }) });

/** What the reader wrote, as the API takes it: a draft kept on this device, or one written now. */
export type NewProposal = { kind: Kind; lemma: string; sense_ordinal?: number | null; location?: string | null; field?: string | null; current_text?: string; text: string; why: string; sources: (Source | string)[] };

export function fromDraft(d: Draft): NewProposal {
  return { kind: d.kind, lemma: d.slug, sense_ordinal: d.ordinal, location: d.at ?? null, field: d.field ?? null, current_text: d.current, text: d.text, why: d.why, sources: d.sources };
}

export const submit = (p: NewProposal) => authFetch<ProposalDetail>("/proposals", { method: "POST", body: JSON.stringify(p) });

let sending = false;

/**
 * Drafts written while signed out go to the queue once the reader signs in (RVQ-Q02, 10 §4.4: sign-in is asked after
 * writing, never before, and the writing is never lost to it). A draft the queue refuses stays, with why, and is not
 * sent again until the reader asks (audit 12 F17); one that could not be sent — offline, signed out, too many for
 * now — waits for the next time.
 */
export async function sendDrafts(): Promise<{ sent: number; kept: number }> {
  if (sending || !useAccount.getState().session) return { sent: 0, kept: 0 };
  sending = true;
  let sent = 0;
  let kept = 0;
  try {
    for (const d of usePersonal.getState().proposals) {
      if (d.refused) {
        kept++;
        continue;
      }
      try {
        await submit(fromDraft(d));
        usePersonal.setState((s) => ({ proposals: s.proposals.filter((x) => x.id !== d.id) }));
        sent++;
      } catch (e) {
        kept++;
        const refused = e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429;
        if (refused) {
          const why = { code: e.code, at: Date.now() };
          usePersonal.setState((s) => ({ proposals: s.proposals.map((x) => (x.id === d.id ? { ...x, refused: why } : x)) }));
          continue;
        }
        break;
      }
    }
  } finally {
    sending = false;
  }
  return { sent, kept };
}

/** Send one refused draft again, as it is or after the reader changed it. */
export function retryDraft(id: string): Promise<{ sent: number; kept: number }> {
  usePersonal.setState((s) => ({ proposals: s.proposals.map((x) => (x.id === id ? { ...x, refused: undefined } : x)) }));
  return sendDrafts();
}
