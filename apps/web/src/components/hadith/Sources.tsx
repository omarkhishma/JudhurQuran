import { useLocale, useTranslations } from "next-intl";
import type { Source } from "@/lib/hadith";

/** The sources a hadith page draws on, each with its credit as its terms ask and its licence. */
export function Sources({ sources }: { sources: (Source | null | undefined)[] }) {
  const t = useTranslations("hadith");
  const locale = useLocale();
  const shown = sources.filter((s): s is Source => !!s).filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i);
  if (!shown.length) return null;
  return (
    <section className="mt-10" aria-labelledby="hadith-sources">
      <h2 id="hadith-sources" className="mb-2 text-[15px] font-semibold text-t2">{t("sourcesTitle")}</h2>
      <ul className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-t3">
        {shown.map((s) => (
          <li key={s.id}>
            <span>{locale === "ar" ? s.attribution_ar : s.attribution_en}</span>{" "}
            {s.license_url ? (
              <a href={s.license_url} className="underline decoration-dotted underline-offset-2 hover:text-t1" rel="noopener noreferrer" target="_blank">
                {t("license", { license: locale === "ar" && s.license_ar ? s.license_ar : s.license })}
              </a>
            ) : (
              <span>{t("license", { license: locale === "ar" && s.license_ar ? s.license_ar : s.license })}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
