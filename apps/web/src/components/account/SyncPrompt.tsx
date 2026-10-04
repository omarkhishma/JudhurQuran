"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { signOutHere } from "@/lib/account/actions";
import { useAccount } from "@/lib/account/store";
import { formatNumber } from "@/lib/format";
import { deleteLocalData, exportLocalData } from "@/lib/localData";
import type { StoreName } from "@/lib/sync/engine";
import { answerDeletions, runSync, setOwner, useSyncStatus } from "@/lib/sync/run";

/**
 * What sync will not decide alone (audit 11 F8, F11), asked on whatever page the reader is on: many records deleted
 * on this device at once — sent to the account and the other devices only on the reader's word, or brought back —
 * and another account's records on this device, taken into this account only if the reader says so.
 */
export function SyncPrompt() {
  const held = useSyncStatus((s) => s.held);
  const owner = useSyncStatus((s) => s.owner);
  const first = useSyncStatus((s) => s.first);
  const stores = Object.entries(held).filter(([, n]) => (n ?? 0) > 0) as [StoreName, number][];
  return (
    <>
      {stores.length > 0 && (
        <div className="storage-warning flex-col !items-stretch" role="alert">
          {stores.map(([store, n]) => (
            <HeldDeletions key={store} store={store} n={n} />
          ))}
        </div>
      )}
      {owner && <OwnerQuestion key={owner} />}
      {!owner && first && <OwnerQuestion key="first" first />}
    </>
  );
}

function HeldDeletions({ store, n }: { store: StoreName; n: number }) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const answer = (send: boolean) => {
    setBusy(true);
    void answerDeletions(store, send).finally(() => setBusy(false));
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="flex-1 text-[13px] leading-relaxed">{t("held", { count: n, n: formatNumber(n, locale), store: t(`store.${store}`) })}</p>
      <button type="button" className="btn min-h-[40px]" disabled={busy} onClick={() => answer(true)}>
        {t("heldSend")}
      </button>
      <button type="button" className="btn min-h-[40px]" disabled={busy} onClick={() => answer(false)}>
        {t("heldKeep")}
      </button>
    </div>
  );
}

/** Another account's records on this device (F8), or this browser's own on no account yet (`first`, M1): the
 * question names the account they would go to, so a reader signed in by someone else's link sees whose it is. */
function OwnerQuestion({ first = false }: { first?: boolean }) {
  const t = useTranslations("account");
  const user = useAccount((s) => s.user);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const add = () => {
    setOwner(user.id);
    useSyncStatus.setState({ first: false });
    setOpen(false);
    void runSync();
  };
  const fresh = async () => {
    setBusy(true);
    await deleteLocalData({ keepAccount: true });
    window.location.reload();
  };
  return (
    <Dialog open={open} onClose={() => setOpen(false)} label={t(first ? "firstTitle" : "ownerTitle")} width={520}>
      <div className="flex flex-col gap-3 p-5">
        <h2 className="text-[17px] font-semibold">{t(first ? "firstTitle" : "ownerTitle")}</h2>
        <p className="text-[13.5px] leading-relaxed text-t2">
          {t.rich(first ? "firstBody" : "ownerBody", {
            email: () => (
              <bdi dir="ltr" className="whitespace-nowrap">
                {user.email}
              </bdi>
            ),
          })}
        </p>
        <div className="flex flex-col gap-2">
          <button type="button" className="btn btn-primary min-h-[40px] justify-center" disabled={busy} onClick={add}>
            {t("ownerAdd")}
          </button>
          {!first && (
            <button type="button" className="btn min-h-[40px] justify-center" disabled={busy} onClick={() => void fresh()}>
              {t("ownerFresh")}
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn min-h-[40px] flex-1 justify-center" disabled={busy} onClick={() => void exportLocalData()}>
              {t("ownerExport")}
            </button>
            <button type="button" className="btn min-h-[40px] flex-1 justify-center" disabled={busy} onClick={() => void signOutHere().then(() => (useSyncStatus.setState({ owner: null, first: false }), setOpen(false)))}>
              {t("ownerSignOut")}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
