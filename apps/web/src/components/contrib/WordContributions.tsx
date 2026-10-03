"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/store";
import { useIsClient } from "@/lib/client";
import { getLemmaContributions, type Merge, myProposals, type ProposalOut, retryDraft, type Source } from "@/lib/contrib";
import { formatNumber, verseRef } from "@/lib/format";
import { type Proposal as Draft, usePersonal } from "@/lib/reader/store";

/** A word's merged contributions, read once per word and shared by every block that shows one. */
export function useWordContributions(slug: string) {
  const client = useIsClient();
  // read again when the reader comes back: a merge made meanwhile shows without a reload (audit 12 F2)
  return useQuery({ queryKey: ["lemma-contrib", slug], queryFn: () => getLemmaContributions(slug), enabled: client, staleTime: 10_000, refetchOnWindowFocus: true });
}

/**
 * The credit a merged contribution carries wherever it shows (RDR-323, RVQ-59…61, RVQ-Q04): who proposed it — the
 * name they chose, "a contributor" without one, "a former contributor" once the account is gone — who reviewed
 * it, the board among them, and its sources; linked to the proposal and its decisions.
 */
export function ContributionCredit({ m }: { m: Merge }) {
  const t = useTranslations("contrib");
  const tw = useTranslations("wordContrib");
  const locale = useLocale();
  // names as the accounts carry them now, each in its own run so a name's direction never turns the line (F14, F16)
  const who = m.contributor ? <bdi>{m.contributor}</bdi> : m.former ? tw("former") : t("aContributor");
  const reviewers = m.reviewers.map((r, i) => (
    <span key={i}>
      {i > 0 && (locale === "ar" ? " و" : " and ")}
      {r.name ? <bdi>{r.name}</bdi> : t("aReviewer")}
      {r.board ? ` (${t("board")})` : ""}
    </span>
  ));
  const src = (s: Source) => `${s.work === "quran" ? t("quranSource") : s.work === "grammar" ? t("grammar") : s.work === "other" ? t("other") : ((locale === "ar" ? s.title_ar : s.title_en) ?? s.work)}${s.ref ? ` ${s.work === "quran" ? verseRef(s.ref, locale) : s.ref}` : ""}`;
  return (
    <p className="text-[11px] leading-relaxed text-t3">
      {tw.rich("creditLine", { who: () => who, reviewers: () => reviewers })}
      {m.sources.length > 0 && ` • ${m.sources.map(src).join(locale === "ar" ? "؛ " : "; ")}`}
      {" • "}
      <Link href={`/review?filter=merged&id=${m.proposal_id}`} prefetch={false} className="underline-offset-2 hover:text-t1 hover:underline">
        {tw("decisions")}
      </Link>
    </p>
  );
}

/** A merged wording shown beside the source it concerns, never over it (DECISIONS, D4, L2). */
export function MergedLine({ m }: { m: Merge }) {
  const tw = useTranslations("wordContrib");
  return (
    <div className="merged-line">
      <p className="text-[11px] font-medium text-good">{tw(`label.${m.kind}`)}</p>
      <p className="text-[14.5px] leading-[1.8]" dir="auto">
        {m.text}
      </p>
      <ContributionCredit m={m} />
    </div>
  );
}

/** Merged senses, numbered after the sourced lines shown above them (P7.3; audit 12 F12). */
export function MergedSenses({ items, after = 0 }: { items: Merge[]; after?: number }) {
  const tw = useTranslations("wordContrib");
  const locale = useLocale();
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={tw("senses")}>
      <p className="label-caps">{tw("senses")}</p>
      <ol className="flex flex-col gap-2">
        {[...items].sort((a, b) => (a.sense_ordinal ?? 0) - (b.sense_ordinal ?? 0)).map((m, i) => (
          <li key={m.id} className="sense-row">
            <span className="mono text-[11px] text-t3">{formatNumber(after + i + 1, locale).padStart(2, locale === "ar" ? "٠" : "0")}</span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[15px] leading-[1.8] text-t1" dir="auto">
                {m.text}
              </p>
              <ContributionCredit m={m} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Accepted corrections, errors, attestations and entries: the editors' notes on the word, credited (P7.3). */
export function EditorsNotes({ items }: { items: Merge[] }) {
  const tw = useTranslations("wordContrib");
  const locale = useLocale();
  const tr = useTranslations("rd");
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={tw("notes")}>
      <p className="label-caps">{tw("notes")}</p>
      {items.map((m) => (
        <div key={m.id} className="merged-line">
          <p className="text-[11px] font-medium text-good">
            {tw(`label.${m.kind}`)}
            {m.field ? ` • ${tr(m.field)}` : ""}
            {m.location ? ` • ${verseRef(m.location, locale)}` : ""}
          </p>
          {m.previous_text && (
            <p className="text-[12.5px] text-t3 line-through" dir="auto">
              {m.previous_text}
            </p>
          )}
          <p className="text-[14px] leading-[1.8]" dir="auto">
            {m.text}
          </p>
          <ContributionCredit m={m} />
        </div>
      ))}
    </section>
  );
}

/** What this reader proposed for the word: drafts kept here, and proposals in the queue with their status (RDR-322). */
export function MyProposals({ slug, drafts }: { slug: string; drafts: Draft[] }) {
  const tw = useTranslations("wordContrib");
  const t = useTranslations("contrib");
  const tr = useTranslations("rd");
  const locale = useLocale();
  const session = useAccount((s) => s.session);
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["my-proposals", session], queryFn: myProposals, enabled: !!session, staleTime: 10_000, refetchOnWindowFocus: true });
  // what is still waiting or sent back; merged, withdrawn, declined and taken-back ones are on the word or the Profile
  const live = (mine.data?.data ?? []).filter((p: ProposalOut) => p.lemma === slug && (p.status === "open" || p.status === "approved" || p.status === "changes"));
  const date = (ms: number | string) => new Date(ms).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long" });
  if (!drafts.length && !live.length) return null;
  return (
    <section className="proposals-mine" aria-label={tw("mine")}>
      <p className="label-caps">{tw("mine")}</p>
      {drafts.map((p) => (
        <DraftRow key={p.id} p={p} signedIn={!!session} date={date(p.ts)} onSent={() => void qc.invalidateQueries({ queryKey: ["my-proposals"] })} />
      ))}
      {live.map((p) => (
        <div key={p.id} className="proposal-row">
          <p className="text-[12px] font-medium text-t2">
            {t(`kind.${p.kind}`)}
            {p.field ? ` • ${tr(p.field)}` : ""}
            {p.location ? ` • ${verseRef(p.location, locale)}` : ""}
          </p>
          <p className="text-[14px] leading-[1.8] text-t1" dir="auto">
            {p.text}
          </p>
          <p className="text-[11px] text-amber">
            {tw(`status.${p.status as "open"}`, { n: formatNumber(p.approvals, locale) })} •{" "}
            <Link href={`/review?filter=mine&id=${p.id}`} prefetch={false} className="underline-offset-2 hover:underline">
              {tw("follow")}
            </Link>
          </p>
        </div>
      ))}
    </section>
  );
}

/** A draft kept on this device: waiting for sign-in, being sent, or refused by the queue — then with the reason in
 * the reader's language, and the choice to send it again or drop it (RVQ-Q02; audit 12 F17). */
function DraftRow({ p, signedIn, date, onSent }: { p: Draft; signedIn: boolean; date: string; onSent: () => void }) {
  const tw = useTranslations("wordContrib");
  const t = useTranslations("contrib");
  const tr = useTranslations("rd");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const drop = () => usePersonal.setState((s) => ({ proposals: s.proposals.filter((x) => x.id !== p.id) }));
  const reason = p.refused ? (p.refused.code && REFUSED.includes(p.refused.code) ? t(`err.${p.refused.code as "settled"}`) : tw("refusedUnknown")) : null;
  return (
    <div className="proposal-row">
      <p className="text-[12px] font-medium text-t2">
        {t(`kind.${p.kind}`)}
        {p.field ? ` • ${tr(p.field)}` : ""}
        {p.at ? ` • ${verseRef(p.at, locale)}` : ""}
      </p>
      <p className="text-[14px] leading-[1.8] text-t1" dir="auto">
        {p.text}
      </p>
      {reason ? (
        <>
          <p className="text-[11.5px] text-bad">{tw("refused", { reason, date })}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn min-h-[40px] text-[12px]"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void retryDraft(p.id).finally(() => (setBusy(false), onSent()));
              }}
            >
              {tw("sendAgain")}
            </button>
            <button type="button" className="btn min-h-[40px] text-[12px]" onClick={drop}>
              {tw("dropDraft")}
            </button>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-amber">{tw(signedIn ? "draftSending" : "draft", { date })}</p>
      )}
    </div>
  );
}

const REFUSED = ["needs_source", "same_wording", "settled", "no_word", "no_place", "place_mismatch", "no_sense", "sense_needed", "no_field", "unknown_source", "source_shape", "quran_ref", "blocked", "unknown_kind"];

/** The reader's drafts for one word. */
export function useDrafts(slug: string): Draft[] {
  const proposals = usePersonal((s) => s.proposals);
  return proposals.filter((p) => p.slug === slug);
}
