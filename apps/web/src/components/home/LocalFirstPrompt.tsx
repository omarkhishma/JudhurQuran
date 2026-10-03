"use client";

import { useLocale, useTranslations } from "next-intl";
import { useIsClient } from "@/lib/client";
import { cnt } from "@/lib/format";
import { exportLocalData } from "@/lib/localData";
import { usePersonal } from "@/lib/reader/store";
import { useSaved } from "@/lib/store/saved";

/**
 * The local-first note (06 §6.1 item 5, HUB-29…35, 48, Q07): on the page, never a modal or a wall, and
 * dismissible. It says what this browser holds, that everything works without an account, and offers the
 * export now. There is no sign-in button until accounts exist (P6): a button that only pretends is not offered.
 */
export function LocalFirstPrompt() {
  const t = useTranslations("hub");
  const locale = useLocale();
  const client = useIsClient();
  const hidden = usePersonal((s) => s.hubPromptHidden);
  const hide = usePersonal((s) => s.hideHubPrompt);
  const saved = useSaved((s) => s.bookmarks.length);
  const notes = useSaved((s) => Object.keys(s.notes).length);
  if (!client || hidden) return null;
  const any = saved + notes > 0;
  return (
    <section className="hub-prompt" aria-labelledby="hub-prompt-title">
      <h2 id="hub-prompt-title" className="text-[15px] font-semibold">
        {any ? t("promptTitle", { saved: t("promptSaved", cnt(saved, locale)), notes: t("promptNotes", cnt(notes, locale)) }) : t("promptTitleEmpty")}
      </h2>
      <p className="text-[13.5px] leading-relaxed text-t2">{t("promptBody")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn min-h-[40px]" onClick={() => void exportLocalData()}>
          {t("promptExport")}
        </button>
        <span className="text-[12px] text-t3">{t("promptNoTracking")}</span>
        <span className="flex-1" />
        <button type="button" className="btn min-h-[40px]" onClick={hide}>
          {t("promptDismiss")}
        </button>
      </div>
    </section>
  );
}
