"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { finishOidc, type Provider, verifyLink } from "@/lib/account/actions";
import { useAccount } from "@/lib/account/store";
import { useIsClient } from "@/lib/client";
import { SignInPanel } from "./SignInPanel";

/** The sign-in page (/signin): the sheet's panel on a page of its own, for links that ask the reader to sign in. */
export function SignInScreen({ returnTo }: { returnTo: string }) {
  const t = useTranslations("account");
  const client = useIsClient();
  const user = useAccount((s) => s.user);
  return (
    <div className="auth-screen">
      <div className="auth-card">
        {client && user ? (
          <>
            <h1 className="text-[19px] font-semibold">{t("signedInAs", { email: user.email })}</h1>
            <Link href="/me" className="btn btn-primary min-h-[44px] self-start">
              {t("myAccount")}
            </Link>
          </>
        ) : (
          <>
            <h1 className="sr-only">{t("signIn")}</h1>
            <SignInPanel returnTo={returnTo} />
          </>
        )}
      </div>
    </div>
  );
}

// a link works once: the same token is never sent twice (development runs each effect twice)
const verifying = new Map<string, Promise<string | null>>();

/** /auth/verify?token=…: the link from the e-mail, exchanged for a session here, then back where the reader was. */
export function VerifyScreen({ token }: { token: string | null }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!token) return;
    // the token leaves the address bar and the history at once
    window.history.replaceState(null, "", window.location.pathname);
    let p = verifying.get(token);
    if (!p) {
      p = verifyLink(token).catch(() => null);
      verifying.set(token, p);
    }
    let live = true;
    void p.then((to) => {
      if (!live) return;
      if (to) router.replace(to);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [token, router]);
  return <AuthStatus state={!token ? "missing" : failed ? "failed" : "working"} message={!token ? t("verifyMissing") : failed ? t("verifyFailed") : t("verifying")} />;
}

const finishing = new Map<string, Promise<{ returnTo: string; locale: string } | null>>();

/** Where Google returns (and Apple, through /api/auth/apple): the code is exchanged by the API, then back. */
export function OidcScreen({ provider, code, state, error }: { provider: Provider; code: string | null; state: string | null; error: string | null }) {
  const t = useTranslations("account");
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const ready = !!code && !!state && !error;
  useEffect(() => {
    if (!code || !state || error) return;
    window.history.replaceState(null, "", window.location.pathname);
    let p = finishing.get(code);
    if (!p) {
      p = finishOidc(provider, code, state).catch(() => null);
      finishing.set(code, p);
    }
    let live = true;
    void p.then((out) => {
      if (!live) return;
      if (out) router.replace(out.returnTo, { locale: out.locale as "ar" | "en" });
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [provider, code, state, error, router]);
  const name = t(provider);
  return <AuthStatus state={!ready || failed ? "failed" : "working"} message={!ready || failed ? t("providerFailed", { provider: name }) : t("finishing", { provider: name })} />;
}

function AuthStatus({ state, message }: { state: "working" | "failed" | "missing"; message: string }) {
  const t = useTranslations("account");
  return (
    <div className="auth-screen">
      <div className="auth-card" role={state === "working" ? "status" : "alert"} aria-busy={state === "working"}>
        <h1 className="text-[17px] font-semibold leading-snug">{message}</h1>
        {state === "working" ? (
          <span className="auth-spinner" aria-hidden="true" />
        ) : (
          <Link href="/signin" className="btn btn-primary min-h-[44px] self-start">
            {state === "missing" ? t("signIn") : t("askAgain")}
          </Link>
        )}
      </div>
    </div>
  );
}
