"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/store";
import { joinClass, previewJoin } from "@/lib/classroom";
import { useIsClient } from "@/lib/client";
import { ConsentText, useClassError } from "./shared";

/**
 * Joining a class by its link (P9.1, CLS-Q02): the class and its instructor, then exactly what the instructor will
 * see and what never; the reader's own choice to show their detail (off, and never in a class for minors); joined
 * only once they say they read it and agree.
 */
export function JoinClass({ code }: { code: string }) {
  const t = useTranslations("classroom");
  const fail = useClassError();
  const client = useIsClient();
  const session = useAccount((s) => s.session);
  const router = useRouter();
  const q = useQuery({ queryKey: ["join", code, session], queryFn: () => previewJoin(code), enabled: client && !!session, retry: false });
  const [agreed, setAgreed] = useState(false);
  const [detail, setDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  if (!client) return <div className="mx-auto h-64 max-w-[720px] animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 py-8">
      <h1 className="text-[22px] font-semibold">{t("joinTitle")}</h1>
      {!session ? (
        <section className="flex flex-col items-start gap-3">
          <p className="text-[14px] leading-relaxed text-t1">{t("joinSignIn")}</p>
          <Link href={`/signin?next=${encodeURIComponent(`/classroom/join/${code}`)}`} className="btn btn-primary">{t("signIn")}</Link>
        </section>
      ) : q.isPending ? (
        <span className="block h-48 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />
      ) : !q.data ? (
        <p role="alert" className="text-[14px] text-t2">{t("joinNotFound")}</p>
      ) : q.data.already ? (
        <section className="flex flex-col items-start gap-3">
          <p className="text-[14px] text-t1">{t(q.data.already === "instructor" ? "joinYouTeach" : "joinAlready", { name: q.data.class.name })}</p>
          <Link href={`/classroom/${q.data.class.id}`} className="btn btn-primary">{t("openClass")}</Link>
        </section>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!agreed || !q.data) return;
            setBusy(true);
            try {
              const c = await joinClass(code, q.data.consent_version, detail && !q.data.class.minors);
              router.push(`/classroom/${c.id}`);
            } catch (err) {
              setSaid(fail(err));
              setBusy(false);
            }
          }}
        >
          <div className="flex flex-col gap-1 rounded-xl border border-line bg-card p-4">
            <p className="text-[18px] font-semibold" dir="auto">{q.data.class.name}</p>
            <p className="text-[13px] text-t2">{t("taughtBy", { name: q.data.instructor.name ?? t("anInstructor") })}</p>
          </div>
          <ConsentText minors={q.data.class.minors} floor={q.data.floor} level={2} />
          {!q.data.class.minors && (
            <label className="flex items-start gap-2 text-[13.5px] text-t1">
              <input type="checkbox" className="mt-1" checked={detail} onChange={(e) => setDetail(e.target.checked)} />
              <span>
                {t("showDetail")}
                <span className="block text-[12px] text-t3">{t("showDetailHint")}</span>
              </span>
            </label>
          )}
          <label className="flex items-start gap-2 text-[13.5px] font-medium text-t1">
            <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
            <span>{t("agree")}</span>
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn btn-primary" disabled={busy || !agreed}>{t("join")}</button>
            <Link href="/classroom" className="btn">{t("notNow")}</Link>
            <span role="status" className="text-[12.5px] text-t2">{said}</span>
          </div>
        </form>
      )}
    </div>
  );
}
