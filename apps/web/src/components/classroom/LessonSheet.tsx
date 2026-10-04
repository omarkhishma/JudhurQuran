"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/store";
import { getLesson, getPack, rangesLine } from "@/lib/classroom";
import { useIsClient } from "@/lib/client";
import { cnt } from "@/lib/format";
import { SAJDA, splitFurniture } from "@/lib/reader/verseText";
import { useLessonVerses, useTranslationShown } from "./LessonPage";
import { NoteLine, useFmt, useSurahNames } from "./shared";

/**
 * A lesson on one printed sheet (B49): its verses as the mushaf writes them, one after another with their numbers,
 * its roots, the instructor's notes, and the text's credit — for a circle that meets with paper. On screen it is the
 * sheet with a print button; in print, the sheet alone.
 */
export function LessonSheet({ id }: { id: string }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const client = useIsClient();
  const session = useAccount((s) => s.session);
  const names = useSurahNames();
  const fmt = useFmt();
  const lesson = useQuery({ queryKey: ["lesson", id, session], queryFn: () => getLesson(id), enabled: client && !!session, retry: false });
  const pack = useQuery({ queryKey: ["lesson-pack", id], queryFn: () => getPack(id), enabled: !!lesson.data });
  const shown = useTranslationShown();
  const verses = useLessonVerses(lesson.data?.ranges ?? [], !!lesson.data, shown);
  if (!client || (session && lesson.isPending)) return <div className="mx-auto my-6 h-64 w-full max-w-[860px] animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!session || !lesson.data)
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-start gap-3 px-4 py-10">
        <h1 className="text-[22px] font-semibold">{t("title")}</h1>
        <p role="alert" className="text-[14px] text-t2">{t(session ? "lessonNotFound" : "signedOut")}</p>
        <Link href={session ? "/classroom" : `/signin?next=${encodeURIComponent(`/classroom/lesson/${id}/sheet`)}`} className="btn">{t(session ? "backToClassroom" : "signIn")}</Link>
      </div>
    );
  const l = lesson.data;
  const notes = pack.data?.notes ?? [];
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <p className="min-w-0 flex-1 text-[13px] text-t2">{t("sheetLead")}</p>
        <Link href={`/classroom/lesson/${id}`} className="btn">{t("sheetBack")}</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>{t("sheetPrint")}</button>
      </div>
      <article className="lesson-sheet flex flex-col gap-4 rounded-xl border border-line bg-card p-6 print:border-0 print:p-0">
        <header className="flex flex-col gap-1 border-b border-line pb-3">
          <p className="text-[12.5px] text-t3" dir="auto">{l.class?.name}</p>
          <h1 className="text-[22px] font-semibold" dir="auto">{l.title}</h1>
          <p className="text-[13px] text-t2">
            {rangesLine(l.ranges, names, fmt)} · {t("versesCount", cnt(l.verses, locale))}
            {l.due_at && ` · ${t("due", { day: new Date(l.due_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" }) })}`}
          </p>
        </header>
        {/* each range under its own heading, its verses running on as in the mushaf, each closed by its number */}
        {l.ranges.map((r, i) => {
          const here = (verses.data?.verses ?? []).filter((v) => v.surah === r.surah && v.ayah >= r.from && v.ayah <= r.to);
          return (
            <section key={i} className="flex flex-col gap-1" aria-label={rangesLine([r], names, fmt)}>
              {l.ranges.length > 1 && <h2 className="label-caps">{rangesLine([r], names, fmt)}</h2>}
              <p className="quran sheet-text" dir="rtl" lang="ar">
                {here.map((v) => (
                  <span key={v.key}>
                    {v.tokens.map((tk) => {
                      const { word, sajda } = splitFurniture(tk.text);
                      return (
                        <span key={tk.position}>
                          {word}
                          {sajda ? ` ${SAJDA}` : ""}{" "}
                        </span>
                      );
                    })}
                    <span className="ayah-num">{v.number_text}</span>{" "}
                  </span>
                ))}
              </p>
            </section>
          );
        })}
        {verses.data?.verses.some((v) => v.translation?.text) && (
          <ol className="flex flex-col gap-1 text-[13px] leading-relaxed text-t2">
            {verses.data.verses.map((v) => v.translation?.text && <li key={v.key} dir="auto">{`(${fmt(v.ayah)}) ${v.translation.text}`}</li>)}
          </ol>
        )}
        {l.roots.length > 0 && (
          <section className="flex flex-wrap items-baseline gap-x-4 gap-y-1" aria-labelledby="sheet-roots">
            <h2 id="sheet-roots" className="label-caps">{t("roots")}</h2>
            {l.roots.map((r) => (
              <span key={r.key} className="ar-classical text-[18px]" lang="ar">{r.spaced}</span>
            ))}
          </section>
        )}
        {notes.length > 0 && (
          <section className="flex flex-col gap-1.5" aria-labelledby="sheet-notes">
            <h2 id="sheet-notes" className="label-caps">{t("sheetNotes")}</h2>
            <ol className={"flex flex-col gap-1 ps-5 text-[14px] text-t1 " + (locale === "ar" ? "[list-style-type:arabic-indic]" : "list-decimal")}>
              {notes.map((n, i) => (
                <li key={i}>
                  <NoteLine n={n} />
                </li>
              ))}
            </ol>
          </section>
        )}
        <footer className="border-t border-line pt-2 text-[11px] leading-relaxed text-t3">{t("sheetCredit")}</footer>
      </article>
    </div>
  );
}
