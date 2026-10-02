import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import type { RootSummary } from "@/lib/types";
import { RootBuilder } from "@/components/roots/RootBuilder";
import { formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/roots">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "roots" });
  return { title: t("indexTitle"), alternates: localized(locale, "/roots") };
}

export default async function RootsIndexPage({ params }: PageProps<"/[locale]/roots">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("roots");
  const { data, total } = await api<{ data: RootSummary[]; total: number }>("/roots?order=alphabetical&limit=2000");
  const groups = new Map<string, RootSummary[]>();
  for (const r of data) {
    const first = r.letters[0] === "ء" ? "أ" : r.letters[0];
    groups.set(first, [...(groups.get(first) ?? []), r]);
  }
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10">
      <header className="mb-6">
        <h1 className="text-[28px] font-semibold">{t("indexTitle")}</h1>
        <p className="mt-1 max-w-[70ch] text-t2">{t("indexLead", { n: formatNumber(total, locale) })}</p>
      </header>
      <RootBuilder />
      <nav aria-label={t("sortAlpha")} className="sticky top-[52px] z-10 -mx-4 mt-8 flex flex-wrap gap-1 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur" dir="rtl">
        {[...groups.keys()].map((letter) => (
          <a key={letter} href={`#letter-${letter}`} className="ar-classical flex h-9 w-9 items-center justify-center rounded-lg text-[18px] text-t2 hover:bg-card hover:text-root" lang="ar">
            {letter}
          </a>
        ))}
      </nav>
      <div className="mt-4 space-y-8">
        {[...groups.entries()].map(([letter, roots]) => (
          <section key={letter} id={`letter-${letter}`} aria-labelledby={`h-${letter}`} className="scroll-mt-28">
            <h2 id={`h-${letter}`} className="ar-classical mb-2 text-[26px] text-root" lang="ar">{letter}</h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" dir="rtl">
              {roots.map((r) => (
                <li key={r.key}>
                  <Link
                    href={`/roots/${encodeURIComponent(r.key)}`}
                    className="flex min-h-[48px] items-center justify-between gap-2 rounded-xl border border-line bg-card px-3 hover:border-root"
                  >
                    <span className="ar-classical text-[19px] text-t1" lang="ar">{r.spaced}</span>
                    <span className="mono text-[11.5px] text-t3">{formatNumber(r.occurrences, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
