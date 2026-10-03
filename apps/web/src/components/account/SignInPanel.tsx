"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { getProviders, type Provider, requestLink, startOidc } from "@/lib/account/actions";
import { cnt, formatNumber } from "@/lib/format";
import { useNotebook } from "@/lib/store/notebook";
import { useSaved } from "@/lib/store/saved";

/**
 * Signing in (HUB-29…36 with HUB-F02, PRF-Q02, D3): asked for, never a wall. It says what this browser holds, that
 * nothing needs an account, and that what is here joins the account without loss. A link by e-mail; Google and
 * Apple only where they are configured — no button that only pretends (the prototype's ORCID and Institution
 * buttons called a fake sign-in, HUB-33).
 */
export function SignInPanel({ returnTo, onClose, headingId }: { returnTo: string; onClose?: () => void; headingId?: string }) {
  const t = useTranslations("account");
  const locale = useLocale();
  const providers = useQuery({ queryKey: ["auth-providers"], queryFn: getProviders, staleTime: 5 * 60_000 });
  const saved = useSaved((s) => s.bookmarks.length);
  const notes = useSaved((s) => Object.keys(s.notes).length) + useNotebook((s) => s.notes.length);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "invalid" | "unavailable" | "failed">("idle");
  const [leaving, setLeaving] = useState<Provider | null>(null);
  const p = providers.data;
  const none = p && !p.email && !p.google && !p.apple;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setState(await requestLink(email.trim(), returnTo, locale));
  }

  async function go(provider: Provider) {
    setLeaving(provider);
    if (!(await startOidc(provider, returnTo, locale))) {
      setLeaving(null);
      setState("failed");
    }
  }

  return (
    <div className="signin">
      <h2 id={headingId} className="text-[17px] font-semibold leading-snug">
        {saved + notes > 0 ? t("titleData", { saved: t("saved", cnt(saved, locale)), notes: t("notes", cnt(notes, locale)) }) : t("titleEmpty")}
      </h2>
      <p className="text-[13.5px] leading-relaxed text-t2">{t("body")}</p>
      <p className="text-[12.5px] leading-relaxed text-t3">{t("bring")}</p>

      {none ? (
        <p className="signin-note" role="status">
          {t("unavailable")}
        </p>
      ) : state === "sent" ? (
        <div className="signin-sent" role="status">
          <p className="text-[14px] font-medium">{t("sentTo", { email: email.trim() })}</p>
          <p className="text-[13px] leading-relaxed text-t2">{t("sent", { minutes: formatNumber(p?.link_minutes ?? 15, locale) })}</p>
          <button type="button" className="btn min-h-[40px] self-start" onClick={() => setState("idle")}>
            {t("otherAddress")}
          </button>
        </div>
      ) : (
        <>
          {p?.email !== false && (
            <form className="signin-form" onSubmit={send} noValidate>
              <label htmlFor="signin-email" className="text-[13px] font-medium">
                {t("emailLabel")}
              </label>
              <div className="signin-row">
                <input
                  id="signin-email"
                  data-autofocus
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  required
                  className="field min-h-[44px] flex-1"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (state !== "idle" && state !== "sending") setState("idle");
                  }}
                  aria-invalid={state === "invalid"}
                  aria-describedby={state === "invalid" || state === "failed" || state === "unavailable" ? "signin-error" : undefined}
                />
                <button type="submit" className="btn btn-primary min-h-[44px]" disabled={state === "sending" || !email.trim()}>
                  {state === "sending" ? t("sending") : t("send")}
                </button>
              </div>
              {(state === "invalid" || state === "failed" || state === "unavailable") && (
                <p id="signin-error" className="text-[12.5px] text-bad" role="alert">
                  {t(state === "invalid" ? "emailInvalid" : state === "unavailable" ? "unavailable" : "failed")}
                </p>
              )}
            </form>
          )}
          {(p?.google || p?.apple) && (
            <div className="signin-providers">
              {p.email && <span className="signin-or">{t("or")}</span>}
              {(["google", "apple"] as const)
                .filter((x) => p[x])
                .map((x) => (
                  <button key={x} type="button" className="btn min-h-[44px] justify-center" disabled={leaving !== null} onClick={() => void go(x)}>
                    {leaving === x ? t("redirecting", { provider: t(x) }) : t(`continue.${x}`)}
                  </button>
                ))}
            </div>
          )}
        </>
      )}

      <div className="signin-foot">
        <Link href="/me" className="text-[12.5px] text-word underline-offset-2 hover:underline" onClick={onClose}>
          {t("exportInstead")}
        </Link>
        <span className="text-t3" aria-hidden="true">
          •
        </span>
        <span className="text-[12px] text-t3">{t("noTracking")}</span>
        {onClose && (
          <>
            <span className="flex-1" />
            <button type="button" className="btn min-h-[40px]" onClick={onClose}>
              {t("notNow")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
