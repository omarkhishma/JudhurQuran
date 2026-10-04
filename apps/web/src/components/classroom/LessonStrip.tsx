"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { lessonForVerse, setFinished, useActiveLessons } from "@/lib/classroomSignals";
import { usePersonal } from "@/lib/reader/store";

/**
 * Said in the reader while it counts for a lesson (P9.2a, research 16 §2): which lesson and class, a link to what the
 * instructor sees, and the member's own "I finished this lesson". Nothing is counted without this being shown.
 */
export function LessonStrip({ chapter }: { chapter: number }) {
  const t = useTranslations("rd");
  const lessons = useActiveLessons((s) => s.lessons);
  const pos = usePersonal((s) => s.progress.quran);
  const at = pos && pos.chapter === chapter ? pos.passage : 1;
  const lesson = lessonForVerse(chapter, at, lessons) ?? lessons.find((l) => l.ranges.some((r) => r.surah === chapter)) ?? null;
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [said, setSaid] = useState("");
  if (!lesson) return null;
  return (
    <div className="lesson-strip" role="note" onClick={(e) => e.stopPropagation()}>
      <span className="dot" style={{ background: "var(--c-sentence)" }} aria-hidden="true" />
      <span className="min-w-0 flex-1">{t("lessonCounts", { lesson: lesson.title, class: lesson.class })}</span>
      <Link href="/classroom" className="text-word underline-offset-2 hover:underline">{t("lessonWhatSeen")}</Link>
      <button
        type="button"
        className="btn min-h-[32px] text-[12.5px]"
        aria-pressed={!!done[lesson.id]}
        onClick={async () => {
          const next = !done[lesson.id];
          try {
            await setFinished(lesson.id, next);
            setDone((d) => ({ ...d, [lesson.id]: next }));
            setSaid(t(next ? "lessonFinished" : "lessonUnfinished"));
          } catch {
            setSaid(t("lessonFailed"));
          }
        }}
      >
        {t(done[lesson.id] ? "lessonFinishedButton" : "lessonFinishButton")}
      </button>
      <span className="sr-only" role="status">{said}</span>
    </div>
  );
}
