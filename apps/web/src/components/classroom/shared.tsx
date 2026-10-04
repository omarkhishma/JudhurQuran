"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { errorKind } from "@/lib/account/errors";
import { ApiError } from "@/lib/account/store";
import { formatNumber, verseRef } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";

type SurahRow = { number: number; name_ar: string; name_translit: string; verse_count: number };

/** The sūras with their names and verse counts, read once. */
export function useSurahs() {
  return useQuery({ queryKey: ["surahs"], queryFn: () => getJSON<{ data: SurahRow[] }>("/surahs"), staleTime: Infinity });
}

/** The sūras' names in the interface's language, by number. */
export function useSurahNames(): Map<number, string> | undefined {
  const locale = useLocale();
  const q = useSurahs();
  return q.data ? new Map(q.data.data.map((s) => [s.number, locale === "ar" ? s.name_ar : s.name_translit])) : undefined;
}

export const useFmt = () => {
  const locale = useLocale();
  return (n: number) => formatNumber(n, locale);
};

/**
 * What an instructor will see of a member, and what never — said before joining and kept on the class's page
 * (research 16 §2). The server enforces each line; this only says it.
 */
export function ConsentText({ minors, floor, level = 3 }: { minors: boolean; floor: number; level?: 2 | 3 }) {
  const t = useTranslations("classroom");
  const fmt = useFmt();
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-t1">
      <section aria-labelledby="consent-sees">
        <H id="consent-sees" className="mb-1 text-[14px] font-semibold">{t("consentSeesTitle")}</H>
        <ul className="flex list-disc flex-col gap-1 ps-5">
          <li>{t("consentName")}</li>
          <li>{t("consentCounts", { floor: fmt(floor) })}</li>
          <li>{t("consentProgress")}</li>
          <li>{t(minors ? "consentDetailMinors" : "consentDetail")}</li>
        </ul>
      </section>
      <section aria-labelledby="consent-never">
        <H id="consent-never" className="mb-1 text-[14px] font-semibold">{t("consentNeverTitle")}</H>
        <p>{t("consentNever")}</p>
      </section>
      <p className="text-[13px] text-t2">{t("consentLeave")}</p>
      {minors && <p className="rounded-lg border border-line bg-card-2 p-3 text-[13px] text-t1">{t("consentMinors")}</p>}
    </div>
  );
}

type NoteLike = { location: string | null; root: string | null; text: string; word?: string | null };

/** A lesson note as it reads: the word as the mushaf writes it and where, the root, the instructor's line. */
export function NoteLine({ n, word }: { n: NoteLike; word?: string }) {
  const locale = useLocale();
  const w = word ?? n.word;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {n.location && w && (
        <span className="quran text-[19px] leading-[1.6]" lang="ar" dir="rtl">
          {w}
        </span>
      )}
      {n.location && (
        <span className="mono text-[11px] text-t3" dir="ltr">
          {verseRef(n.location, locale)}
        </span>
      )}
      {n.root && (
        <span className="ar-classical text-[15px]" lang="ar">
          {[...n.root].join(" ")}
        </span>
      )}
      {n.text && <span dir="auto">{n.text}</span>}
    </span>
  );
}

const REFUSALS = ["not_instructor", "not_member", "instructor_edits", "class_only", "not_found", "already", "closed", "decided", "has_map", "no_map", "own_class", "taken", "too_large", "bad_ranges", "bad_roots", "bad_due", "consent", "empty", "too_long", "nothing_new", "too_many_notes", "too_many_proposals", "bad_proposal", "archived", "same_class"] as const;
type Refused = (typeof REFUSALS)[number];

/** What went wrong in the classroom, as the reader is told it: the API's reason in the reader's language, else the
 * account's plain words (offline, signed out, busy) — never the API's English (audit 11 F21). */
export function useClassError() {
  const t = useTranslations("classroom");
  const ta = useTranslations("account");
  return (e: unknown): string => {
    if (e instanceof ApiError && e.code) {
      const key = e.code === "too_many" ? (e.status === 429 ? "too_many_proposals" : "too_many_notes") : e.code;
      if ((REFUSALS as readonly string[]).includes(key)) return t(`err.${key as Refused}`);
    }
    return ta(`err.${errorKind(e)}`);
  };
}
