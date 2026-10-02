import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import { HomeSearch } from "@/components/home/HomeSearch";
import { citeVerse, cnt, formatNumber } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[locale]/search">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: t("pageTitle"), robots: { index: false, follow: true } };
}

// Results depend on the query string: rendered per request (the API search call itself is cached).
export const dynamic = "force-dynamic";

const EXAMPLES = ["الرحمن", "ك ت ب", "2:255", "الصلاة", "يا أيها الذين آمنوا", "s-b-r"];

export default async function SearchPage({ params, searchParams }: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 200);
  const t = await getTranslations("search");
  const tc = await getTranslations("common");
  const res = q ? await api<SearchResult>(`/search?q=${encodeURIComponent(q)}&limit=30`, { revalidate: 3600 }) : null;
  const r = res?.results;
  const empty = r && !r.verses.length && !r.surahs.length && !r.roots.length && !r.words.length && !r.lemmas.length;

  return (
    <div className="mx-auto max-w-[960px] px-4 py-10">
      <h1 className="text-[28px] font-semibold">{t("pageTitle")}</h1>
      <p className="mt-1 max-w-[70ch] text-t2">{t("pageLead")}</p>
      <div className="mt-5">
        <HomeSearch initial={q} />
      </div>
      {!q && (
        <div className="mt-6">
          <p className="mb-2 text-[13px] text-t3">{t("hint")}</p>
          <ul className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <li key={e}>
                <Link href={`/search?q=${encodeURIComponent(e)}`} className="chip min-h-[36px]">{e}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {res && (
        <p className="mt-5 text-[13px] text-t3" aria-live="polite">
          {t("understood", { kind: locale === "ar" ? res.detected.label_ar : res.detected.label_en })}
        </p>
      )}
      {empty && <p className="mt-6 rounded-xl bg-card p-5 text-t2">{t("noResults")}</p>}
      {r && (
        <div className="mt-6 space-y-8">
          {r.surahs.length > 0 && (
            <Section title={t("sectionSurahs")}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {r.surahs.map((s) => (
                  <li key={s.number}>
                    <Link href={`/quran/${s.number}`} className="card flex items-center justify-between p-4 hover:border-ring">
                      <span className="ar-classical text-[22px]" lang="ar">{`سورة ${s.name_ar}`}</span>
                      <span className="text-[12.5px] text-t3">{tc("verses", cnt(s.verse_count, locale))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {r.roots.length > 0 && (
            <Section title={t("sectionRoots")}>
              <ul className="flex flex-wrap gap-2">
                {r.roots.map((x) => (
                  <li key={x.key}>
                    <Link href={`/roots/${encodeURIComponent(x.key)}`} className="flex min-h-[48px] items-center gap-3 rounded-xl border border-line bg-card px-4 hover:border-root">
                      <span className="ar-classical text-[22px] text-root" lang="ar">{x.spaced}</span>
                      <span className="text-[12px] text-t3">{t("rootMeta", { occurrences: formatNumber(x.occurrences, locale), lemmas: formatNumber(x.lemma_count, locale) })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {r.words.length > 0 && (
            <Section title={t("sectionWords")}>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {r.words.map((w) => (
                  <li key={`${w.form}-${w.lemma_id}`}>
                    <Link href={`/word/${w.sample}`} className="card flex h-full items-center justify-between gap-3 p-3 hover:border-ring">
                      <span>
                        <span className="ar-classical block text-[21px]" lang="ar">{w.display}</span>
                        {w.root && <span className="ar-classical text-[14px] text-root" lang="ar">{w.root.split("").join(" ")}</span>}
                      </span>
                      <span className="text-end text-[12px] text-t3">{t("formMeta", cnt(w.occurrences, locale))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {r.lemmas.length > 0 && (
            <Section title={t("sectionLemmas")}>
              <ul className="flex flex-wrap gap-2">
                {r.lemmas.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={l.root ? `/roots/${encodeURIComponent(l.root)}#lemma-${l.id}` : `/search?q=${encodeURIComponent(l.ar)}`}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl border border-line bg-card px-3 hover:border-ring"
                    >
                      <span className="ar-classical text-[19px]" lang="ar">{l.ar}</span>
                      {locale === "en" && l.gloss_en && <span className="text-[12.5px] text-t2">{l.gloss_en}</span>}
                      <span className="mono text-[11.5px] text-t3">{formatNumber(l.occurrences, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {r.verses.length > 0 && (
            <Section title={t("sectionVerses")}>
              <ul className="space-y-2">
                {r.verses.map((v) => (
                  <li key={v.key}>
                    <Link href={`/quran/${v.surah}/${v.ayah}`} className="card block p-4 hover:border-ring">
                      <span className="quran block text-[22px] leading-[2.1]" dir="rtl" lang="ar">{v.text_qpc}</span>
                      <span className="text-[12.5px] text-t3">{citeVerse(v.name_ar, v.surah, v.ayah, locale, v.name_translit)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="label-caps mb-3">{title}</h2>
      {children}
    </section>
  );
}
