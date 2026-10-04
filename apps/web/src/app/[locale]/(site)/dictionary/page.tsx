import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FindRoot } from "@/components/dictionary/FindRoot";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import type { DictLetter } from "@/lib/dictionary";
import { cnt, cnt2, formatNumber } from "@/lib/format";
import type { LexiconWork } from "@/lib/types";
import { localized } from "@/lib/seo";

export const revalidate = 86400;

async function counts() {
  const { data } = await api<{ data: DictLetter[] }>("/dictionary/letters");
  return { letters: data, roots: data.reduce((n, x) => n + x.roots, 0), quranic: data.reduce((n, x) => n + x.quranic, 0) };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/dictionary">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dictionary" });
  const c = await counts();
  return { title: t("title"), description: t("indexLead", { ...cnt(c.roots, locale), ...cnt2(c.quranic, locale) }), alternates: localized(locale, "/dictionary") };
}

/** The Arabic dictionary (P11.1): every root the classical lexica file an article under, the Quran's and the others,
 * by letter; the lexica in the order their authors died. */
export default async function DictionaryPage({ params }: PageProps<"/[locale]/dictionary">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dictionary");
  const [c, works] = await Promise.all([counts(), api<{ data: (LexiconWork & { kind: string })[] }>("/lexicon/works")]);
  // the nine lexica (the gharīb works gloss the Quran's words, not roots)
  const lexica = works.data.filter((w) => w.kind !== "gharib");
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[locale === "ar" ? "الرئيسية" : "Home", "/"], [t("title"), "/dictionary"]])} />
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold">{t("title")}</h1>
        <p className="max-w-[70ch] leading-relaxed text-t2">{t("indexLead", { ...cnt(c.roots, locale), ...cnt2(c.quranic, locale) })}</p>
      </header>
      <FindRoot />
      <nav aria-label={t("letters")} className="mt-8">
        <h2 className="mb-3 text-[17px] font-semibold">{t("letters")}</h2>
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7" dir="rtl">
          {c.letters.map((l) => (
            <li key={l.letter}>
              <Link href={`/dictionary/letter/${encodeURIComponent(l.letter)}`} className="flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-card px-2 py-2 hover:border-root">
                <span className="ar-classical text-[24px] leading-none text-root" lang="ar">{l.letter}</span>
                <span className="text-[11.5px] text-t3">{formatNumber(l.roots, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <section className="mt-10" aria-labelledby="lexica-h">
        <h2 id="lexica-h" className="mb-1 text-[17px] font-semibold">{t("lexicaTitle")}</h2>
        <p className="mb-3 max-w-[70ch] text-[13.5px] leading-relaxed text-t2">{t("lexicaLead")}</p>
        <ol className="flex flex-col divide-y divide-line rounded-xl border border-line bg-card">
          {lexica.map((w) => (
            <li key={w.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5">
              <span className={w.lang === "ar" ? "ar-classical text-[17px]" : "text-[14px]"} lang={w.lang}>
                {locale === "ar" || w.lang === "ar" ? w.title_ar : w.title_en}
              </span>
              <span className="text-[12.5px] text-t3">
                {locale === "ar" ? `${w.author_ar}${w.death_hijri ? ` (ت ${formatNumber(w.death_hijri, locale)}هـ)` : ""}` : `${w.author_en}${w.death_ce ? ` (d. ${w.death_ce})` : ""}`}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[12.5px] text-t3">
          {t("displayOnly")} <Link href="/sources" className="underline underline-offset-2">{t("sources")}</Link>
        </p>
      </section>
    </div>
  );
}
