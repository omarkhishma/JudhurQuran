"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/store";
import { useIsClient } from "@/lib/client";
import { getLemmaContributions, type Merge, myProposals, type ProposalOut, type Source } from "@/lib/contrib";
import { formatNumber } from "@/lib/format";
import { type Proposal as Draft, usePersonal } from "@/lib/reader/store";

/** A word's merged contributions, read once per word and shared by every block that shows one. */
export function useWordContributions(slug: string) {
  const client = useIsClient();
  return useQuery({ queryKey: ["lemma-contrib", slug], queryFn: () => getLemmaContributions(slug), enabled: client, staleTime: 60_000 });
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
  const who = m.contributor ?? (m.former ? tw("former") : t("aContributor"));
  const reviewers = m.reviewers.map((r) => `${r.name ?? t("aReviewer")}${r.board ? ` (${t("board")})` : ""}`).join(locale === "ar" ? " و" : " and ");
  const src = (s: Source) => `${s.work === "quran" ? t("quranSource") : s.work === "grammar" ? t("grammar") : s.work === "other" ? t("other") : ((locale === "ar" ? s.title_ar : s.title_en) ?? s.work)}${s.ref ? ` ${s.ref}` : ""}`;
  return (
    <p className="text-[11px] leading-relaxed text-t3">
      {tw("credit", { who, reviewers })}
      {m.sources.length > 0 && ` • ${m.sources.map(src).join("؛ ")}`}
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

/** Merged senses, numbered after the sourced ones (P7.3). */
export function MergedSenses({ items }: { items: Merge[] }) {
  const tw = useTranslations("wordContrib");
  const locale = useLocale();
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={tw("senses")}>
      <p className="label-caps">{tw("senses")}</p>
      <ol className="flex flex-col gap-2">
        {items.map((m) => (
          <li key={m.id} className="sense-row">
            <span className="mono text-[11px] text-t3">{formatNumber(m.sense_ordinal ?? 0, locale).padStart(2, locale === "ar" ? "٠" : "0")}</span>
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
            {m.location ? ` • ${m.location}` : ""}
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
  const mine = useQuery({ queryKey: ["my-proposals", session], queryFn: myProposals, enabled: !!session, staleTime: 30_000 });
  const live = (mine.data?.data ?? []).filter((p: ProposalOut) => p.lemma === slug && p.status !== "merged" && p.status !== "withdrawn");
  const date = (ms: number | string) => new Date(ms).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long" });
  if (!drafts.length && !live.length) return null;
  return (
    <section className="proposals-mine" aria-label={tw("mine")}>
      <p className="label-caps">{tw("mine")}</p>
      {drafts.map((p) => (
        <div key={p.id} className="proposal-row">
          <p className="text-[12px] font-medium text-t2">
            {t(`kind.${p.kind}`)}
            {p.field ? ` • ${tr(p.field)}` : ""}
            {p.at ? ` • ${p.at}` : ""}
          </p>
          <p className="text-[14px] leading-[1.8] text-t1" dir="auto">
            {p.text}
          </p>
          <p className="text-[11px] text-amber">{tw(session ? "draftSending" : "draft", { date: date(p.ts) })}</p>
        </div>
      ))}
      {live.map((p) => (
        <div key={p.id} className="proposal-row">
          <p className="text-[12px] font-medium text-t2">
            {t(`kind.${p.kind}`)}
            {p.field ? ` • ${tr(p.field)}` : ""}
            {p.location ? ` • ${p.location}` : ""}
          </p>
          <p className="text-[14px] leading-[1.8] text-t1" dir="auto">
            {p.text}
          </p>
          <p className="text-[11px] text-amber">
            {tw(`status.${p.status}`, { n: formatNumber(p.approvals, locale) })} •{" "}
            <Link href={`/review?filter=mine&id=${p.id}`} prefetch={false} className="underline-offset-2 hover:underline">
              {tw("follow")}
            </Link>
          </p>
        </div>
      ))}
    </section>
  );
}

/** The reader's drafts for one word. */
export function useDrafts(slug: string): Draft[] {
  const proposals = usePersonal((s) => s.proposals);
  return proposals.filter((p) => p.slug === slug);
}
