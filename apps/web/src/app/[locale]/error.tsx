"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => {
    console.error(error);
    // counted, with nothing about who: its kind, its message, the page's path (P12, ops.py; the privacy page says so)
    try {
      const body = JSON.stringify({ kind: (error.name || "Error").slice(0, 80), message: `${error.message ?? ""}${error.digest ? ` [${error.digest}]` : ""}`.slice(0, 300), place: location.pathname.slice(0, 400) });
      if (!navigator.sendBeacon?.("/api/v1/ops/errors", new Blob([body], { type: "application/json" }))) void fetch("/api/v1/ops/errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    } catch {}
  }, [error]);
  return (
    <div className="mx-auto flex max-w-[640px] flex-1 flex-col items-center justify-center px-4 py-24 text-center" role="alert">
      <h1 className="text-[24px] font-semibold">{t("errorTitle")}</h1>
      <p className="mt-2 text-t2">{t("errorBody")}</p>
      <button type="button" className="btn mt-6 min-h-[40px] px-5" onClick={reset}>
        {t("retry")}
      </button>
    </div>
  );
}
