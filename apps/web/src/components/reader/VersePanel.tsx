"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";
import { usePrefs } from "@/lib/store/reader";
import { citeVerse, verseRef } from "@/lib/format";
import type { Work } from "@/lib/types";
import { useCommentary } from "./hooks";

export function VersePanel({ verseKey, surahName, onClose }: { verseKey: string; surahName: string; onClose?: () => void }) {
  const t = useTranslations("panel");
  const tr = useTranslations("reader");
  const locale = useLocale();
  const tafsirs = usePrefs((s) => s.tafsirs);
  const translation = usePrefs((s) => s.translation);
  const [active, setActive] = useState<string>(tafsirs[0] ?? "muyassar");
  const [copied, setCopied] = useState<string | null>(null);
  const works = useQuery({
    queryKey: ["works"],
    queryFn: async () => ((await (await fetch("/api/v1/works")).json()) as { data: Work[] }).data,
  });
  const ids = [active, translation];
  const { data, isLoading } = useCommentary(verseKey, ids);
  const tafsir = data?.data.find((d) => d.work.id === active);
  const trans = data?.data.find((d) => d.work.id === translation);
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

  const tafsirWorks = (works.data ?? []).filter((w) => w.kind === "tafsir");
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

      <section className="border-b border-line px-5 py-3">
        <p className="label-caps mb-2">{t("chooseTafsir")}</p>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("chooseTafsir")}>
          {tafsirWorks.map((w) => (
            <button
              key={w.id}
              type="button"
              role="tab"
              aria-selected={w.id === active}
              className={"chip " + (w.id === active ? "is-on" : "")}
              onClick={() => setActive(w.id)}
            >
              <span className="ar-classical text-[14px]" lang="ar">{w.title_ar}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 py-4" role="tabpanel" aria-busy={isLoading}>
        {isLoading && <p className="text-t3">…</p>}
        {tafsir && (
          <>
            {tafsir.passage ? (
              <>
                {tafsir.passage.verse_from !== tafsir.passage.verse_to && (
                  <p className="mb-2 text-[12px] text-t3">
                    {t("passageRange", { from: verseRef(tafsir.passage.verse_from, locale), to: verseRef(tafsir.passage.verse_to, locale) })}
                  </p>
                )}
                <div className="ar-classical whitespace-pre-line text-[17px] leading-[2.05] text-t1" dir="rtl" lang="ar">
                  {tafsir.passage.text}
                </div>
              </>
            ) : (
              <p className="text-t3">{t("noPassage")}</p>
            )}
            <WorkCredit work={tafsir.work} />
          </>
        )}
      </section>

      {trans?.passage && (
        <section className="border-t border-line px-5 py-4">
          <p className="label-caps mb-2">{t("translationTab")} — {trans.work.title_en}</p>
          <p className="text-[15px] leading-relaxed text-t1" dir="ltr" lang="en">{trans.passage.text}</p>
          {trans.passage.footnotes && (
            <details className="mt-2 text-[13px] text-t2" dir="ltr" lang="en">
              <summary className="cursor-pointer text-t3">{t("footnotes")}</summary>
              <p className="mt-1 whitespace-pre-line">{trans.passage.footnotes}</p>
            </details>
          )}
          <WorkCredit work={trans.work} />
        </section>
      )}
    </div>
  );
}

function WorkCredit({ work }: { work: Work }) {
  const locale = useLocale();
  const t = useTranslations("panel");
  return (
    <p className="mt-4 border-t border-line pt-2 text-[11.5px] leading-relaxed text-t3">
      {locale === "ar" ? `${work.title_ar} — ${work.author_ar}` : `${work.title_en} — ${work.author_en}`}
      {" · "}
      {t("version", { version: work.version })}
      {" · "}
      <a href={work.source_url} target="_blank" rel="noreferrer" className="hover:underline">
        {locale === "ar" ? work.attribution_ar : work.attribution_en}
      </a>
    </p>
  );
}
