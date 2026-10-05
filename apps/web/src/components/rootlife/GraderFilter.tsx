import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import type { GraderRulings } from "@/lib/rootlife";

const SHOWN = 12; // a grader's commonest rulings; one grader's terms run to more than a thousand notes

/**
 * The hadith by one grader's ruling (B57): choose a grader, then one of their rulings — said in their own terms, in
 * Arabic where the dataset gives it — and only the hadith that grader rules so are listed. Never a grade of the
 * hadith's own: the graders disagree, and the page says so. Links only, rendered on the server.
 */
export async function GraderFilter({ graders, grader, ruling, href, locale }: { graders: GraderRulings[]; grader: string | null; ruling: string | null; href: (g: string | null, r: string | null) => string; locale: string }) {
  const t = await getTranslations("rootTexts");
  const chosen = graders.find((g) => g.grader === grader) ?? null;
  const chip = (on: boolean) => `chip${on ? " is-on" : ""}`;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-card px-3 py-2">
      <nav aria-label={t("graderLabel")} className="flex flex-wrap items-center gap-1.5">
        <span className="label-caps">{t("graderLabel")}</span>
        <Link href={href(null, null)} className={chip(!chosen)} aria-current={!chosen ? "page" : undefined}>{t("graderAll")}</Link>
        {graders.map((g) => (
          <Link key={g.grader} href={href(g.grader, null)} className={chip(chosen?.grader === g.grader)} aria-current={chosen?.grader === g.grader && !ruling ? "page" : undefined} lang="ar">
            {g.grader_ar ?? g.grader}
          </Link>
        ))}
      </nav>
      {chosen && (
        <nav aria-label={t("rulingLabel", { grader: chosen.grader_ar ?? chosen.grader })} className="flex flex-wrap items-center gap-1.5">
          {chosen.rulings.slice(0, SHOWN).map((r) => (
            <Link key={r.value} href={href(chosen.grader, r.value)} className={chip(ruling === r.value)} aria-current={ruling === r.value ? "page" : undefined} lang={r.value_ar ? "ar" : "en"} dir={r.value_ar ? "rtl" : "ltr"}>
              {r.value_ar ?? r.value} <span className="text-t3">{formatNumber(r.n, locale)}</span>
            </Link>
          ))}
        </nav>
      )}
      <p className="text-[12px] leading-relaxed text-t3">{t("graderNote")}</p>
    </div>
  );
}
