import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageJumpForm } from "@/components/reader5/PageJumpForm";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";

export const revalidate = 86400;

export async function generateMetadata({ params }: PageProps<"/[locale]/mushaf">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rd" });
  return { title: t("mushafTitle"), description: t("mushafLead"), alternates: localized(locale, "/mushaf") };
}

type Part = { number: number; key: string; page: number; name_ar: string; name_translit: string };

/** The mushaf by its pages (B1): a page by its number, and where each of the thirty parts begins. */
export default async function MushafIndex({ params }: PageProps<"/[locale]/mushaf">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("rd");
  const d = await api<{ juz: Part[] }>("/divisions");
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-semibold">{t("mushafTitle")}</h1>
        <p className="max-w-[720px] text-[14px] leading-relaxed text-t2">{t("mushafLead")}</p>
      </header>
      <PageJumpForm />
      <section aria-labelledby="juz-h" className="flex flex-col gap-3">
        <h2 id="juz-h" className="text-[17px] font-semibold">{t("mushafParts")}</h2>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {d.juz.map((j) => (
            <li key={j.number}>
              <Link href={`/mushaf/${j.page}`} className="flex flex-col rounded-lg border border-line bg-card px-3 py-2 hover:border-t3">
                <span className="text-[13.5px] font-medium">{t("juzN", { n: formatNumber(j.number, locale) })}</span>
                <span className="text-[12px] text-t3">{t("pageN", { n: formatNumber(j.page, locale) })} • <span lang="ar">{j.name_ar}</span></span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
