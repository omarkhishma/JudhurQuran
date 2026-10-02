"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";
import { citeVerse } from "@/lib/format";
import { TafsirSection } from "./TafsirSection";

export function VersePanel({ verseKey, surahName, onClose }: { verseKey: string; surahName: string; onClose?: () => void }) {
  const t = useTranslations("panel");
  const tr = useTranslations("reader");
  const locale = useLocale();
  const [copied, setCopied] = useState<string | null>(null);
  const verseText = typeof document !== "undefined"
    ? Array.from(document.querySelectorAll<HTMLElement>(`[data-verse="${verseKey}"] .w`)).map((w) => w.textContent).join(" ")
    : "";
  const [s, a] = verseKey.split(":");

  async function copy(kind: "text" | "link") {
    const value =
      kind === "text"
        ? `﴿${verseText}﴾ [${surahName}: ${a}]`
        : `${window.location.origin}${locale === "en" ? "/en" : ""}/quran/${s}/${a}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch {}
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-card px-5 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] text-t3">{citeVerse(surahName, Number(verseKey.split(":")[0]), Number(verseKey.split(":")[1]), locale)}</p>
          {onClose && (
            <button type="button" className="btn icon-btn" aria-label={t("close")} onClick={onClose}>
              <Icon name="close" />
            </button>
          )}
        </div>
        <p className="quran mt-1 max-h-[30vh] overflow-y-auto text-[24px] leading-[2.1]" dir="rtl" lang="ar">{verseText}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className="btn" onClick={() => copy("text")} aria-live="polite">
            <Icon name={copied === "text" ? "check" : "copy"} />
            {copied === "text" ? tr("copiedVerse") : t("copyVerse")}
          </button>
          <button type="button" className="btn" onClick={() => copy("link")}>
            <Icon name={copied === "link" ? "check" : "share"} />
            {t("shareVerse")}
          </button>
          <Link href={`/quran/${s}/${a}`} className="btn">
            <Icon name="external" />
            {tr("studyVerse")}
          </Link>
        </div>
      </header>

      <TafsirSection verseKey={verseKey} />
    </div>
  );
}

