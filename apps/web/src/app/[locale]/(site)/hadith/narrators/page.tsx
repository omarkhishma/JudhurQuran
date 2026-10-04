import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cnt, formatNumber } from "@/lib/format";
import { type NarratorCard, narratorHref } from "@/lib/hadith";
import { localized } from "@/lib/seo";

// a page of a list is read from ?page (or ?q): rendered for each request, the API answers it from its cache
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/hadith/narrators">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hadith" });
  return { title: t("narratorsTitle"), description: t("narratorsLead"), alternates: localized(locale, "/hadith/narrators") };
}

/** The narrators (P11.2b): found by the name a chain gives them, the most linked first. */
export default async function NarratorsPage({ params, searchParams }: PageProps<"/[locale]/hadith/narrators">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hadith");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const found = q ? (await api<{ data: (NarratorCard & { links: number })[] }>(`/narrators?q=${encodeURIComponent(q)}&limit=40`)).data : null;
  const ar = locale === "ar";
  return (
    <div className="mx-auto max-w-[900px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[ar ? "الرئيسية" : "Home", "/"], [t("homeTitle"), "/hadith"], [t("narratorsTitle"), "/hadith/narrators"]])} />
      <nav className="mb-4 flex flex-wrap gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/hadith" className="hover:text-t1">{t("homeTitle")}</Link>
      </nav>
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold">{t("narratorsTitle")}</h1>
        <p className="max-w-[70ch] leading-relaxed text-t2">{t("narratorsLead")}</p>
      </header>
      <form method="get" role="search" className="mb-6 flex max-w-[560px] flex-wrap gap-2">
        <label htmlFor="narrator-q" className="sr-only">{t("narratorSearch")}</label>
        <input id="narrator-q" name="q" defaultValue={q} dir="rtl" lang="ar" required className="field min-w-0 flex-1 text-[16px]" placeholder={t("narratorSearchPlaceholder")} />
        <button type="submit" className="btn btn-primary">{t("searchGo")}</button>
      </form>
      {found && !found.length && <p className="text-[14px] text-t2" role="status">{t("narratorNone")}</p>}
      {found && found.length > 0 && (
        <ul className="flex flex-col gap-2">
          {found.map((n) => (
            <li key={n.id}>
              <Link href={narratorHref(n.id)} className="card flex flex-col gap-1 p-3 hover:border-root">
                <span className="ar-classical text-[18px] leading-snug" lang="ar" dir="rtl">{n.name}</span>
                <span className="text-[12px] text-t3">
                  {n.verdict && <bdi lang="ar">{n.verdict}</bdi>}
                  {n.tabaqa && <>{n.verdict ? " • " : ""}{t("tabaqa", { n: formatNumber(n.tabaqa, locale) })}</>}
                  {n.death_ah && <> • {t("death", { year: formatNumber(n.death_ah, locale) })}</>}
                  {n.links > 0 && <> • {t("inRecords", cnt(n.links, locale))}</>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
