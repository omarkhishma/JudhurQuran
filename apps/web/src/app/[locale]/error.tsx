"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => {
    console.error(error);
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
