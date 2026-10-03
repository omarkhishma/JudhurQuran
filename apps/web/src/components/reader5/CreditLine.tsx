"use client";

import { useLocale, useTranslations } from "next-intl";

/**
 * The full credit a reused text asks for (CC BY-NC-SA 4.0 and OpenITI's terms): the attribution the source
 * gives (author, edition, digital text, release), a link to the licence, and what we changed — the words
 * are quoted as they stand, only cut into entries.
 */
export function CreditLine({ s }: { s: { attribution_ar: string; attribution_en: string; licence?: string | null; licence_url?: string | null } }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  return (
    <li className="text-[10.5px] leading-relaxed text-t3">
      {locale === "ar" ? s.attribution_ar : s.attribution_en}
      {s.licence_url && (
        <>
          {" • "}
          <a href={s.licence_url} target="_blank" rel="noreferrer license" className="underline-offset-2 hover:text-t1 hover:underline">
            {s.licence ?? t("licence")}
          </a>
        </>
      )}
      {" • "}
      {t("creditChanges")}
    </li>
  );
}
