import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import type { Explanation } from "@/lib/hadith";

const BOOK_AR: { [slug: string]: string } = {
  bukhari: "صحيح البخاري",
  muslim: "صحيح مسلم",
  abudawud: "سنن أبي داود",
  tirmidhi: "جامع الترمذي",
  nasai: "سنن النسائي",
  ibnmajah: "سنن ابن ماجه",
};
const BOOK_EN: { [slug: string]: string } = {
  bukhari: "Ṣaḥīḥ al-Bukhārī",
  muslim: "Ṣaḥīḥ Muslim",
  abudawud: "Sunan Abī Dāwūd",
  tirmidhi: "Jāmiʿ al-Tirmidhī",
  nasai: "Sunan al-Nasāʾī",
  ibnmajah: "Sunan Ibn Mājah",
};

/** HadeethEnc's items citing this hadith (P11.2c): each as HadeethEnc publishes it, unchanged, with its version — the
 * hadith in its wording, its explanation, benefits and word meanings, its own verdict and attribution — said to be
 * HadeethEnc's citing this number, never our text. */
export function Explanations({ items }: { items: Explanation[] }) {
  const t = useTranslations("hadith");
  const locale = useLocale();
  if (!items.length) return null;
  return (
    <section className="mt-10 flex flex-col gap-4" aria-labelledby="expl-h">
      <h2 id="expl-h" className="text-[17px] font-semibold">{t("explTitle")}</h2>
      {items.map((x) => (
        <article key={x.id} className="card flex flex-col gap-3 p-4" lang="ar" dir="rtl">
          <p className="text-[12.5px] text-t3" dir="auto" lang={locale}>
            {t("explCites", { book: (locale === "ar" ? BOOK_AR : BOOK_EN)[x.cites.book] ?? x.cites.book, number: formatNumber(x.cites.number, locale) })}
            {x.status === "partly" && <> — {t("explPartly")}</>}
          </p>
          <h3 className="ar-classical text-[19px] leading-snug">{x.title}</h3>
          <details>
            <summary className="cursor-pointer text-[13px] text-t2" lang={locale} dir="auto">{t("explHadith")}</summary>
            <p className="ar-classical mt-2 whitespace-pre-line text-[17px] leading-loose">{x.text}</p>
          </details>
          <div>
            <h4 className="mb-1 text-[14px] font-semibold" lang={locale} dir="auto">{t("explExplanation")}</h4>
            <p className="whitespace-pre-line text-[16px] leading-loose">{x.explanation}</p>
          </div>
          {x.benefits.length > 0 && (
            <div>
              <h4 className="mb-1 text-[14px] font-semibold" lang={locale} dir="auto">{t("explBenefits")}</h4>
              <ul className="list-disc ps-5 text-[15px] leading-loose">
                {x.benefits.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {x.word_meanings.length > 0 && (
            <div>
              <h4 className="mb-1 text-[14px] font-semibold" lang={locale} dir="auto">{t("explWords")}</h4>
              <dl className="flex flex-col gap-1 text-[15px] leading-relaxed">
                {x.word_meanings.map((w, i) => (
                  <div key={i}>
                    {w.word && <dt className="inline font-semibold">{w.word}: </dt>}
                    <dd className="inline">{w.meaning}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-t2" lang={locale} dir="auto">
            {x.grade && <span>{t("explGrade", { grade: x.grade })}</span>}
            {x.attribution && <span>{t("explAttribution", { attribution: x.attribution })}</span>}
            {x.link && (
              <a href={x.link} className="underline decoration-dotted underline-offset-2 hover:text-t1" rel="noopener noreferrer" target="_blank">
                {t("explOpen")}
              </a>
            )}
          </p>
        </article>
      ))}
    </section>
  );
}
