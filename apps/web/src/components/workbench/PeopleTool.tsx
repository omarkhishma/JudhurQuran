"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { getPeople, grantRole, ROLES, setBlocked, type Person } from "@/lib/editorial";
import { useWorkbenchRefusal } from "./refusal";

/**
 * Roles (P14.4): for administrators only — the accounts that hold a role or a block, or the one an address names;
 * a role given or taken back and an account blocked or let again, each recorded with its reason beside the grants.
 * An address is shown here and nowhere else (D3).
 */
export function PeopleTool() {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const qc = useQueryClient();
  const refusal = useWorkbenchRefusal();
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("editor");
  const [reason, setReason] = useState("");
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const people = useQuery({ queryKey: ["people", asked], queryFn: () => getPeople(asked) });

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setSaid("");
    try {
      await fn();
      setSaid(done);
      await qc.invalidateQueries({ queryKey: ["people"] });
    } catch (e) {
      setSaid(refusal(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="people-h">
      <h2 id="people-h" className="text-[18px] font-semibold">{t("peopleTitle")}</h2>
      <p className="text-[12.5px] leading-relaxed text-t3">{t("peopleLead")}</p>

      <form
        className="workbench-box flex flex-col gap-2"
        aria-label={t("peopleGive")}
        onSubmit={(e) => {
          e.preventDefault();
          void act(() => grantRole(email.trim(), role, reason), t("peopleSaidGiven"));
        }}
      >
        <h3 className="text-[14px] font-semibold">{t("peopleGive")}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input className="field-input min-w-[220px] flex-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("peopleEmail")} aria-label={t("peopleEmail")} dir="ltr" required />
          <select className="field-input" value={role} onChange={(e) => setRole(e.target.value)} aria-label={t("peopleRole")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{t(`role_${r}`)}</option>
            ))}
          </select>
          <input className="field-input min-w-[160px] flex-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("peopleReason")} aria-label={t("peopleReason")} dir="auto" maxLength={300} />
          <button type="submit" className="btn btn-primary" disabled={busy || !email.trim()}>{t("peopleGiveButton")}</button>
        </div>
      </form>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(query.trim());
        }}
      >
        <input className="field-input flex-1" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("peopleSearch")} aria-label={t("peopleSearch")} dir="ltr" />
        <button type="submit" className="btn">{t("relFind")}</button>
      </form>
      <p className="text-[12.5px] text-t2" role="status" aria-live="polite">{said}</p>
      {people.isPending ? (
        <span className="block h-24 animate-pulse rounded-lg bg-card-2" aria-hidden="true" />
      ) : people.isError ? (
        <p role="alert" className="text-[13px] text-t2">{refusal(people.error)}</p>
      ) : (
        <ul className="workbench-rows">
          {people.data.data.map((p: Person) => (
            <li key={p.email} className="workbench-row flex-wrap">
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-t1" dir="ltr">{p.email}</span>
              {p.name && <bdi className="text-[12.5px] text-t3">{p.name}</bdi>}
              <span className="text-[11.5px] text-t3">{t("peopleSince", { date: new Date(p.since).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB") })}</span>
              <select className="field-input text-[12.5px]" value={p.role} disabled={busy || p.you} onChange={(e) => void act(() => grantRole(p.email, e.target.value, ""), t("peopleSaidGiven"))} aria-label={t("peopleRoleOf", { email: p.email })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{t(`role_${r}`)}</option>
                ))}
              </select>
              {!p.you && (
                <button type="button" className="btn text-[12px]" disabled={busy} onClick={() => void act(() => setBlocked(p.email, !p.blocked, ""), t(p.blocked ? "peopleSaidUnblocked" : "peopleSaidBlocked"))}>
                  {t(p.blocked ? "peopleUnblock" : "peopleBlock")}
                </button>
              )}
              {p.blocked && <span className="state-chip is-changes">{t("peopleBlocked")}</span>}
              {p.you && <span className="state-chip is-approved">{t("you")}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
