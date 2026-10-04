import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { permanentRedirect } from "next/navigation";
import { DictionaryLexicon } from "@/components/dictionary/DictionaryLexicon";
import { RootMaps } from "@/components/graph/RootMaps";
import { RootInTexts } from "@/components/rootlife/RootInTexts";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { dictHref, type DictRoot } from "@/lib/dictionary";
import { cnt, formatNumber } from "@/lib/format";
import type { RootInTexts as RootInTextsData } from "@/lib/rootlife";
import { localized } from "@/lib/seo";

export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

async function load(raw: string) {
  return api<DictRoot>(`/dictionary/roots/${encodeURIComponent(decodeURIComponent(raw))}`);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/dictionary/[root]">): Promise<Metadata> {
  const { locale, root } = await params;
  const r = await load(root);
  const t = await getTranslations({ locale, namespace: "dictionary" });
  const lexica = r.works.map((w) => (locale === "ar" ? w.title_ar : w.title_en)).join(locale === "ar" ? "، " : ", ");
  const description = r.works.length ? t("rootDescription", { root: r.spaced, n: formatNumber(r.works.length, locale), lexica }) : t("rootDescriptionFiled", { root: r.spaced });
  return { title: t("rootTitle", { root: r.spaced }), description, alternates: localized(locale, dictHref(r.key)) };
}

/** A root in the dictionary (P11.1): every lexicon's articles on it, in the order their authors died; the Quran as
 * one layer — its counts and pages when the Quran has the root, said plainly when it does not. */
export default async function DictionaryRootPage({ params }: PageProps<"/[locale]/dictionary/[root]">) {
  const { locale, root } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dictionary");
  const r = await load(root);
  // the root beyond the Quran and the lexica (P11.4b): its passages in the hadith and the books
  const inTexts = await api<RootInTextsData>(`/roots/${encodeURIComponent(r.key)}/texts?limit=5`).catch(() => null);
  // one address per root: a spelling a reader typed (سما, اخذ) goes to the root it reached
  if (decodeURIComponent(root) !== r.key) permanentRedirect(dictHref(r.key));
  const n = (x: number) => formatNumber(x, locale);
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <JsonLd
        data={breadcrumbs(locale, [
          [locale === "ar" ? "الرئيسية" : "Home", "/"],
          [t("title"), "/dictionary"],
          [t("letterTitle", { letter: r.first === "ا" ? "ء" : r.first }), `/dictionary/letter/${encodeURIComponent(r.first === "ا" ? "ء" : r.first)}`],
          [r.spaced, dictHref(r.key)],
        ])}
      />
      <nav className="mb-4 flex flex-wrap gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/dictionary" className="hover:text-t1">{t("title")}</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/dictionary/letter/${encodeURIComponent(r.first === "ا" ? "ء" : r.first)}`} className="hover:text-t1">
          {t("letterTitle", { letter: r.first === "ا" ? "ء" : r.first })}
        </Link>
      </nav>
      <header className="flex flex-col gap-3">
        <h1 className="sr-only">{t("rootTitle", { root: r.spaced })}</h1>
        <p className="ar-classical px-3 text-[56px] leading-none text-root md:text-[72px]" lang="ar" aria-hidden="true">{r.spaced}</p>
        <p className="flex flex-wrap gap-2 text-[13px] text-t2">
          <span className="state-chip">{t(`kind${r.letters}`)}</span>
          {r.works.length > 0 && <span className="state-chip">{t("inLexica", cnt(r.works.length, locale))}</span>}
          {r.quran && <span className="state-chip is-approved">{t("inQuranChip")}</span>}
        </p>
        {r.unsure && <p className="max-w-[70ch] rounded-lg border border-amber/40 bg-amber/5 px-3 py-2 text-[13px] leading-relaxed text-t2">{t("unsureRoot")}</p>}
      </header>

      {/* the Quran as one layer among many */}
      <section className="mt-8" aria-labelledby="quran-h">
        <h2 id="quran-h" className="mb-2 text-[17px] font-semibold">{t("quranTitle")}</h2>
        {r.quran ? (
          <div className="card flex flex-col gap-3 p-4">
            <p className="text-[14px] text-t1">
              {t("inQuran", { occ: r.quran.occurrences, occN: n(r.quran.occurrences), vc: r.quran.verse_count, vcN: n(r.quran.verse_count), sc: r.quran.surah_count, scN: n(r.quran.surah_count), lc: r.quran.lemma_count, lcN: n(r.quran.lemma_count) })}
            </p>
            <p className="flex flex-wrap gap-2">
              <Link href={`/roots/${encodeURIComponent(r.quran.key)}`} className="btn">{t("quranRootPage")}</Link>
              <Link href={`/concordance?root=${encodeURIComponent(r.quran.key)}`} className="btn">{t("quranConcordance")}</Link>
            </p>
          </div>
        ) : (
          <p className="text-[14px] text-t2">{t("notInQuran")}</p>
        )}
      </section>

      {r.filed_under && (
        <section className="mt-8" aria-labelledby="filed-h">
          <h2 id="filed-h" className="mb-2 text-[17px] font-semibold">{t("lexicaTitle")}</h2>
          <p className="card p-4 text-[14px] leading-relaxed text-t2">
            {t("filedUnder")}{" "}
            <Link href={dictHref(r.filed_under.key)} className="ar-classical text-[18px] text-root underline underline-offset-2" lang="ar">
              {r.filed_under.display}
            </Link>
          </p>
        </section>
      )}

      {r.works.length > 0 && (
        <section className="mt-8" aria-labelledby="lex-h">
          <h2 id="lex-h" className="mb-1 text-[17px] font-semibold">{t("lexicaTitle")}</h2>
          <p className="mb-3 max-w-[70ch] text-[13px] leading-relaxed text-t3">{t("rootLexicaLead", cnt(r.articles, locale))}</p>
          <DictionaryLexicon root={r} />
        </section>
      )}

      {inTexts && <RootInTexts data={inTexts} />}
      {/* the readers' published maps holding it, when it is the Quran's: maps are drawn from the Quran's roots (B60) */}
      {r.quran && <RootMaps rootKey={r.quran.key} spaced={r.quran.spaced} />}

      <nav className="mt-10 flex flex-wrap justify-between gap-2 border-t border-line pt-4 text-[13px]" aria-label={t("leaf")}>
        {r.prev ? (
          <Link href={dictHref(r.prev.key)} className="btn" rel="prev">
            {t("prevRoot")} <span className="ar-classical text-[16px]" lang="ar">{r.prev.display}</span>
          </Link>
        ) : (
          <span />
        )}
        {r.next && (
          <Link href={dictHref(r.next.key)} className="btn" rel="next">
            {t("nextRoot")} <span className="ar-classical text-[16px]" lang="ar">{r.next.display}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
