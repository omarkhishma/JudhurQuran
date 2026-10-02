"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { usePrefs } from "@/lib/store/reader";
import { verseRef } from "@/lib/format";
import type { Commentary, Work } from "@/lib/types";
import { useCommentary } from "./hooks";

/** Tafsir chooser + passage + translation, with each work's credit line. Seedable from the server. */
export function TafsirSection({
  verseKey,
  initialWorks,
  initialCommentary,
}: {
  verseKey: string;
  initialWorks?: Work[];
  initialCommentary?: Commentary;
}) {
  const t = useTranslations("panel");
  const tafsirs = usePrefs((s) => s.tafsirs);
  const translation = usePrefs((s) => s.translation);
  const [active, setActive] = useState<string>(initialCommentary?.data[0]?.work.id ?? tafsirs[0] ?? "muyassar");
  const works = useQuery({
    queryKey: ["works"],
    queryFn: async () => ((await (await fetch("/api/v1/works")).json()) as { data: Work[] }).data,
    initialData: initialWorks,
  });
  const ids = [active, translation];
  const seeded = initialCommentary && initialCommentary.data.map((d) => d.work.id).join(",") === ids.join(",") ? initialCommentary : undefined;
  const { data, isLoading } = useCommentary(verseKey, ids, seeded);
  const tafsir = data?.data.find((d) => d.work.id === active);
  const trans = data?.data.find((d) => d.work.id === translation);
  const tafsirWorks = (works.data ?? []).filter((w) => w.kind === "tafsir");
  const locale = useLocale();

  return (
    <>
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
    </>
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
