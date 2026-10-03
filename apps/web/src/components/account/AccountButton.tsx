"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Icon } from "@/components/Icon";
import { Dialog } from "@/components/ui/Dialog";
import { Link, usePathname } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/store";
import { useIsClient } from "@/lib/client";
import { useSyncStatus } from "@/lib/sync/run";
import { SignInPanel } from "./SignInPanel";

/** The reader's initial for the avatar: their chosen name, else their address. */
export const initial = (name: string | null | undefined, email: string) => Array.from((name || email).trim())[0]?.toUpperCase() ?? "?";

/**
 * The header's account control (SHL-21, HUB-41): signed out, "Sign in" opens the sheet; signed in, the avatar opens
 * the Profile. A dot on the avatar says when sync is waiting for the network or the reader's answer, or failed.
 */
export function AccountButton({ className = "btn" }: { className?: string }) {
  const t = useTranslations("account");
  const client = useIsClient();
  const user = useAccount((s) => s.user);
  const sync = useSyncStatus((s) => s.state);
  // sync waits for the reader's word: deletions held, or another account's records on this device (F8, F11)
  const waits = useSyncStatus((s) => !!s.owner || Object.keys(s.held).length > 0);
  const pathname = usePathname();
  // where the reader was when they asked, so the link brings them back there
  const [returnTo, setReturnTo] = useState<string | null>(null);
  if (!client) return <span className="account-slot" aria-hidden="true" />;
  if (user) {
    const name = user.display_name || user.email;
    const label = waits ? `${t("accountOf", { name })} — ${t("syncWaits")}` : t("accountOf", { name });
    return (
      <Link href="/me" className="account-avatar" title={label} aria-label={label}>
        <span aria-hidden="true">{initial(user.display_name, user.email)}</span>
        {(waits || sync === "offline" || sync === "error") && <span className={"account-dot is-" + (waits ? "waits" : sync)} aria-hidden="true" />}
      </Link>
    );
  }
  return (
    <>
      <button type="button" className={className + " account-signin"} onClick={() => setReturnTo(pathname + window.location.search)} aria-haspopup="dialog">
        <Icon name="user" size={15} className="min-[900px]:hidden" />
        <span className="max-[899px]:sr-only">{t("signIn")}</span>
      </button>
      <SignInSheet returnTo={returnTo} onClose={() => setReturnTo(null)} />
    </>
  );
}

/** The sign-in sheet, open while `returnTo` is set. */
export function SignInSheet({ returnTo, onClose }: { returnTo: string | null; onClose: () => void }) {
  const t = useTranslations("account");
  const heading = useId();
  return (
    <Dialog open={returnTo !== null} onClose={onClose} label={t("signIn")} width={520} align="bottom" className="signin-sheet">
      <button type="button" className="btn icon-btn signin-close" aria-label={t("close")} onClick={onClose}>
        <Icon name="close" size={14} />
      </button>
      <SignInPanel returnTo={returnTo ?? "/me"} onClose={onClose} headingId={heading} />
    </Dialog>
  );
}
