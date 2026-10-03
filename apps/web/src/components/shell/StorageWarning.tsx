"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { exportLocalData } from "@/lib/localData";
import { storageFailed } from "@/lib/store/safeStorage";

/**
 * A browser that refuses to store (a full quota, private mode) is said on every page, once, and stays said until
 * the reader dismisses it (RDR-444, NTB-Q01): what they do still works this session, and the export keeps it.
 */
export function StorageWarning() {
  const t = useTranslations("common");
  const [shown, setShown] = useState<"no" | "yes" | "dismissed">("no");
  useEffect(() => {
    const onFail = () => setShown((s) => (s === "no" ? "yes" : s));
    if (storageFailed()) queueMicrotask(onFail); // a write that failed while the page was loading
    window.addEventListener("jadhr:storage-error", onFail);
    return () => window.removeEventListener("jadhr:storage-error", onFail);
  }, []);
  if (shown !== "yes") return null;
  return (
    <div className="storage-warning" role="alert">
      <p className="flex-1 text-[13px] leading-relaxed">{t("storageFailed")}</p>
      <button type="button" className="btn min-h-[40px]" onClick={() => void exportLocalData()}>{t("storageExport")}</button>
      <button type="button" className="btn min-h-[40px]" onClick={() => setShown("dismissed")}>{t("storageDismiss")}</button>
    </div>
  );
}
