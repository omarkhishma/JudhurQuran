import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { dictHref, type DictLetter, type DictRootRow } from "@/lib/dictionary";
import { cnt, cnt2, formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";

export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

/** Every root of a letter, a page of the API at a time (a letter has at most about 1,100). */
async function load(letter: string): Promise<DictRootRow[]> {
  const out: DictRootRow[] = [];
  let after: string | null = null;
  do {
    const page: { data: DictRootRow[]; next: string | null } = await api(`/dictionary/roots?first=${encodeURIComponent(letter)}&limit=500${after ? `&after=${encodeURIComponent(after)}` : ""}`);
    out.push(...page.data);
    after = page.next;
  } while (after);
  return out;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/dictionary/letter/[letter]">): Promise<Metadata> {
  const { locale, letter } = await params;
  const t = await getTranslations({ locale, namespace: "dictionary" });
  const l = decodeURIComponent(letter);
  return { title: t("letterTitle", { letter: l }), alternates: localized(locale, `/dictionary/letter/${encodeURIComponent(l)}`) };
}

const SIZES = [3, 4, 5, 2] as const;

export default async function LetterPage({ params }: PageProps<"/[locale]/dictionary/letter/[letter]">) {
  const { locale, letter } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dictionary");
  const l = decodeURIComponent(letter);
  const { data: letters } = await api<{ data: DictLetter[] }>("/dictionary/letters");
  const at = letters.findIndex((x) => x.letter === l);
  if (at < 0) notFound();
  const roots = await load(l);
  const prev = letters[at - 1];
  const next = letters[at + 1];
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[locale === "ar" ? "الرئيسية" : "Home", "/"], [t("title"), "/dictionary"], [t("letterTitle", { letter: l }), `/dictionary/letter/${encodeURIComponent(l)}`]])} />
      <nav className="mb-4 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/dictionary" className="hover:text-t1">{t("title")}</Link>
      </nav>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold">{t("letterTitle", { letter: l })}</h1>
          <p className="mt-1 text-t2">{t("letterLead", { ...cnt(letters[at].roots, locale), ...cnt2(letters[at].quranic, locale) })}</p>
        </div>
        <p className="flex gap-2 text-[13px]">
          {prev && <Link href={`/dictionary/letter/${encodeURIComponent(prev.letter)}`} className="btn">{t("prevLetter", { letter: prev.letter })}</Link>}
          {next && <Link href={`/dictionary/letter/${encodeURIComponent(next.letter)}`} className="btn">{t("nextLetter", { letter: next.letter })}</Link>}
        </p>
      </header>
      <p className="mb-4 flex items-center gap-2 text-[12.5px] text-t3">
        <span className="inline-block h-2 w-2 rounded-full bg-root" aria-hidden="true" /> {t("quranMarkLegend")}
      </p>
      <div className="space-y-8">
        {SIZES.map((size) => {
          const list = roots.filter((r) => r.letters === size);
          if (!list.length) return null;
          return (
            <section key={size} aria-labelledby={`size-${size}`}>
              <h2 id={`size-${size}`} className="mb-2 text-[17px] font-semibold">
                {t(`size${size}`)} <span className="text-[13px] font-normal text-t3">{formatNumber(list.length, locale)}</span>
              </h2>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7" dir="rtl">
                {list.map((r) => (
                  <li key={r.key}>
                    <Link href={dictHref(r.key)} prefetch={false} className="flex min-h-[48px] items-center justify-between gap-1.5 rounded-xl border border-line bg-card px-2.5 hover:border-root">
                      <span className="ar-classical text-[19px] text-t1" lang="ar">{r.display}</span>
                      <span className="flex items-center gap-1 text-[11px] text-t3">
                        {r.quran_root && (
                          <span className="inline-block h-2 w-2 rounded-full bg-root" role="img" aria-label={t("quranMark")} />
                        )}
                        {formatNumber(r.lexica.length, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
