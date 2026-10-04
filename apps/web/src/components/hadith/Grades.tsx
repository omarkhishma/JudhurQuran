import { useLocale, useTranslations } from "next-intl";
import type { Grade } from "@/lib/hadith";

/** The graders' rulings, each under the grader whose ruling it is and the work it comes from (D8); a value is shown
 * as the compilation writes it, beside its Arabic rendering where the register has one. */
export function Grades({ grades, compact = false }: { grades: Grade[]; compact?: boolean }) {
  const t = useTranslations("hadith");
  const locale = useLocale();
  if (!grades.length) return null;
  if (compact)
    return (
      <ul className="flex flex-wrap gap-1.5 text-[12px]" aria-label={t("gradesTitle")}>
        {grades.map((g, i) => (
          <li key={i} className="state-chip" title={g.work_ar ? t("gradeIn", { work: g.work_ar }) : undefined}>
            <bdi>{locale === "ar" ? g.grader_ar : g.grader_en}</bdi>: <bdi>{(locale === "ar" && g.value_ar) || g.value}</bdi>
          </li>
        ))}
      </ul>
    );
  return (
    <ul className="flex flex-col gap-2">
      {grades.map((g, i) => (
        <li key={i} className="flex flex-col gap-0.5 rounded-lg border border-line bg-card px-3 py-2">
          <span className="text-[14px]">
            <bdi className="font-semibold">{(locale === "ar" && g.value_ar) || g.value}</bdi>
            {g.value_ar && locale === "ar" && g.value !== g.value_ar && <span className="text-[12px] text-t3"> (<bdi dir="ltr">{g.value}</bdi>)</span>}
            {!g.value_ar && <span className="text-[12px] text-t3"> — {t("gradeAsPublished")}</span>}
          </span>
          <span className="text-[12.5px] text-t2">
            <bdi>{locale === "ar" ? g.grader_ar : g.grader_en}</bdi>
            {g.work_ar && <>، {t("gradeIn", { work: g.work_ar })}</>}
          </span>
        </li>
      ))}
    </ul>
  );
}
