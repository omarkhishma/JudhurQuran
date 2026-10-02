"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useIsClient } from "@/lib/client";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";
import { usePrefs } from "@/lib/store/reader";
import { formatNumber } from "@/lib/format";

export function ReaderToolbar({
  surah,
  nameAr,
  nameTranslit,
  verseCount,
}: {
  surah: number;
  nameAr: string;
  nameTranslit: string;
  verseCount: number;
}) {
  const t = useTranslations("reader");
  const ts = useTranslations("surah");
  const locale = useLocale();
  const prefs = usePrefs();
  const hydrated = useIsClient();
  const showTranslation = prefs.showTranslation ?? locale === "en";
  const [jump, setJump] = useState("");

  return (
    <div
      className="sticky top-[52px] z-20 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80"
      role="toolbar"
      aria-label={t("toolbarLabel")}
    >
      <div className="mx-auto flex max-w-[860px] flex-wrap items-center gap-2 px-4 py-2">
        <div className="flex min-w-0 items-center gap-1">
          {surah > 1 && (
            <Link href={`/quran/${surah - 1}`} className="btn icon-btn" aria-label={ts("prev")} rel="prev">
              <Icon name="chevronStart" />
            </Link>
          )}
          <span className="ar-classical truncate px-1 text-[18px] text-t1" lang="ar">{`سورة ${nameAr}`}</span>
          <span className="hidden truncate text-[12px] text-t3 sm:inline" dir="ltr" lang="en">{nameTranslit}</span>
          {surah < 114 && (
            <Link href={`/quran/${surah + 1}`} className="btn icon-btn" aria-label={ts("next")} rel="next">
              <Icon name="chevronEnd" />
            </Link>
          )}
        </div>
        <form
          className="flex items-center gap-1 max-sm:hidden"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(jump.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
            if (n >= 1 && n <= verseCount) {
              const el = document.getElementById(`v${n}`);
              el?.scrollIntoView({ block: "center", behavior: "smooth" });
              el?.classList.add("is-target");
              setTimeout(() => el?.classList.remove("is-target"), 2400);
            }
          }}
        >
          <label className="sr-only" htmlFor="jump">{t("jumpToVerse")}</label>
          <input
            id="jump"
            inputMode="numeric"
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            placeholder={`${formatNumber(1, locale)}–${formatNumber(verseCount, locale)}`}
            className="h-[30px] w-20 rounded-lg border border-line bg-card px-2 text-center text-[13px] outline-none focus:border-ring max-[899px]:h-10"
          />
        </form>
        <div className="ms-auto flex items-center gap-1.5">
          <div className="seg-group max-sm:hidden" role="group" aria-label={t("textSize")}>
            <button type="button" className="seg" onClick={() => prefs.set({ scale: Math.max(0.8, +(prefs.scale - 0.1).toFixed(1)) })} aria-label={t("textSmaller")}>
              <Icon name="minus" size={12} />
            </button>
            <span className="mono flex min-w-[44px] items-center justify-center text-[11.5px] text-t3" aria-live="polite">
              {hydrated ? `${Math.round(prefs.scale * 100)}%` : "100%"}
            </span>
            <button type="button" className="seg" onClick={() => prefs.set({ scale: Math.min(2, +(prefs.scale + 0.1).toFixed(1)) })} aria-label={t("textLarger")}>
              <Icon name="plus" size={12} />
            </button>
          </div>
          <ReaderSettings showTranslation={hydrated && showTranslation} />
        </div>
      </div>
    </div>
  );
}

function ReaderSettings({ showTranslation }: { showTranslation: boolean }) {
  const t = useTranslations("reader");
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="relative">
      <button type="button" className="btn icon-btn" aria-label={t("settings")} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="settings" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="popover absolute end-0 top-11 z-40 w-[290px] max-w-[calc(100vw-24px)] p-3" role="dialog" aria-label={t("settings")}>
            <Toggle label={t("translationOn")} checked={showTranslation} onChange={(v) => prefs.set({ showTranslation: v })} />
            <Toggle label={t("inlineTafsir")} checked={prefs.inlineTafsir} onChange={(v) => prefs.set({ inlineTafsir: v })} />
            <Toggle label={t("highlightRoot")} hint={t("highlightRootHint")} checked={prefs.highlightRoot} onChange={(v) => prefs.set({ highlightRoot: v })} />
            <Toggle label={t("explainTerms")} hint={t("explainTermsHint")} checked={prefs.explainTerms} onChange={(v) => prefs.set({ explainTerms: v })} />
            <p className="label-caps mt-3 mb-1.5">{t("textSize")}</p>
            <div className="seg-group w-full" role="group" aria-label={t("textSize")}>
              <button type="button" className="seg flex-1" onClick={() => prefs.set({ scale: Math.max(0.8, +(prefs.scale - 0.1).toFixed(1)) })} aria-label={t("textSmaller")}>
                <Icon name="minus" size={12} />
              </button>
              <span className="mono flex min-w-[52px] items-center justify-center text-[12px] text-t2">{`${Math.round(prefs.scale * 100)}%`}</span>
              <button type="button" className="seg flex-1" onClick={() => prefs.set({ scale: Math.min(2, +(prefs.scale + 0.1).toFixed(1)) })} aria-label={t("textLarger")}>
                <Icon name="plus" size={12} />
              </button>
            </div>
            <p className="label-caps mt-3 mb-1.5">{t("layoutLabel")}</p>
            <div className="seg-group w-full">
              {(["verses", "flow"] as const).map((l) => (
                <button key={l} type="button" className="seg flex-1" aria-pressed={prefs.layout === l} onClick={() => prefs.set({ layout: l })}>
                  {l === "verses" ? t("layoutVerses") : t("layoutFlow")}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 rounded-lg px-1 py-2 text-start hover:bg-card-2">
      <span className={"relative mt-0.5 h-4 w-7 shrink-0 rounded-full transition-colors " + (checked ? "bg-ring" : "bg-line-2")}>
        <span className={"absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all " + (checked ? "start-3.5" : "start-0.5")} />
      </span>
      <span>
        <span className="block text-[13px] text-t1">{label}</span>
        {hint && <span className="block text-[11.5px] leading-snug text-t3">{hint}</span>}
      </span>
    </button>
  );
}
