"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { ApiError, SignedOut, useAccount } from "@/lib/account/store";
import { useIsClient } from "@/lib/client";
import { formatNumber } from "@/lib/format";
import { getOpsErrors, OPS_DAYS, type OpsSource } from "@/lib/ops";

const SOURCES: OpsSource[] = ["web", "api", "monitor"];

/**
 * What went wrong (B61, PLAN P12): the errors the pages met, those the API did not handle and what the monitor's
 * check found unanswered, counted by day — kind, place, release, how often — for the board's administrators, beside
 * the command line (`python -m jadhr_api.ops errors`). Nothing in them is about anyone (ops.py).
 */
export function OpsErrors() {
  const t = useTranslations("ops");
  const locale = useLocale();
  const client = useIsClient();
  const session = useAccount((s) => s.session);
  const [days, setDays] = useState<number>(7);
  const q = useQuery({ queryKey: ["ops-errors", session, days], queryFn: () => getOpsErrors(days), enabled: client && !!session, retry: false });

  if (!client) return <div className="mx-auto h-64 max-w-[1000px] animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!session || q.error instanceof SignedOut)
    return (
      <Gate title={t("title")}>
        <p>{t("gateSignIn")}</p>
        <Link href="/signin?next=/workbench/errors" className="btn btn-primary self-start">{t("signIn")}</Link>
      </Gate>
    );
  if (q.error instanceof ApiError && q.error.status === 403)
    return (
      <Gate title={t("title")}>
        <p>{t("gateNotAdmin")}</p>
      </Gate>
    );
  const when = (iso: string) => new Date(iso).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-semibold">{t("title")}</h1>
        <p className="max-w-[75ch] text-[13.5px] leading-relaxed text-t2">{t("lead")}</p>
      </header>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("period")}>
        {OPS_DAYS.map((d) => (
          <button key={d} type="button" className={"chip" + (days === d ? " is-on" : "")} aria-pressed={days === d} onClick={() => setDays(d)}>
            {t("days", { n: d, shown: formatNumber(d, locale) })}
          </button>
        ))}
      </div>
      {q.isError ? (
        <p role="alert" className="text-[13.5px] text-bad">{t("loadFailed")}</p>
      ) : !q.data ? (
        <div className="h-32 animate-pulse rounded-xl bg-card-2" aria-busy="true" />
      ) : (
        <>
          <p className="text-[13px] text-t2" role="status">
            {SOURCES.map((s) => `${t(`source_${s}`)}: ${formatNumber(q.data.totals[s] ?? 0, locale)}`).join(" • ")}
          </p>
          {q.data.rows.length === 0 ? (
            <p className="text-[14px] text-t2">{t("none")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {q.data.rows.map((r) => (
                <li key={`${r.source}|${r.kind}|${r.place}|${r.message}|${r.release}`} className="flex flex-col gap-1 rounded-[12px] border border-line bg-card px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[18px] font-semibold tabular-nums">
                      <span className="sr-only">{t("times")} </span>
                      {formatNumber(r.count, locale)}
                    </span>
                    <span className="chip">{t(`source_${r.source}`)}</span>
                    <bdi dir="ltr" className="font-mono text-[13px] text-t1">{r.kind}</bdi>
                    <bdi dir="ltr" className="font-mono text-[13px] text-t2 [overflow-wrap:anywhere]">{r.place}</bdi>
                  </div>
                  {r.message && (
                    <p dir="ltr" className="text-start font-mono text-[12.5px] leading-relaxed text-t2 [overflow-wrap:anywhere]">
                      {r.message}
                    </p>
                  )}
                  <p className="text-[12px] text-t3">
                    {[r.release ? t("release", { v: r.release }) : null, t("last", { when: when(r.last_at) })].filter(Boolean).join(" • ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Gate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-3 px-4 py-16 text-[14px] leading-relaxed text-t2">
      <h1 className="text-[22px] font-semibold text-t1">{title}</h1>
      {children}
    </div>
  );
}
