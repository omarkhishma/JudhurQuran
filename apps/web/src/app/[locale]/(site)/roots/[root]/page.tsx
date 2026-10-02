import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import type { RootDetail, Source, Surah } from "@/lib/types";
import { DistributionChart } from "@/components/roots/DistributionChart";
import { Concordance } from "@/components/roots/Concordance";
import { RootLexicon } from "@/components/lexicon/RootLexicon";
import { Icon } from "@/components/Icon";
import { formatNumber, toArabicDigits } from "@/lib/format";

export const revalidate = 86400;

async function load(raw: string) {
  return api<RootDetail>(`/roots/${encodeURIComponent(decodeURIComponent(raw))}`);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/roots/[root]">): Promise<Metadata> {
  const { locale, root } = await params;
  const r = await load(root);
  const t = await getTranslations({ locale, namespace: "roots" });
  const title = t("rootMetaTitle", { root: r.spaced, n: formatNumber(r.occurrences, locale) });
  const lemmas = r.lemmas.slice(0, 6).map((l) => l.ar).join("، ");
  const description =
    locale === "ar"
      ? `ورد جذر (${r.spaced}) في القرآن الكريم ${formatNumber(r.occurrences, locale)} مرة في ${formatNumber(r.verse_count, locale)} آية من ${formatNumber(r.surah_count, locale)} سورة، بصيغ منها: ${lemmas}. شاهد عائلته ومواضعه وسياقاته.`
      : `The root ${r.translit} (${r.spaced}) occurs ${r.occurrences} times in ${r.verse_count} verses of the Quran, in ${r.lemma_count} lemmas. See its family, distribution and every occurrence in context.`;
  const path = `/roots/${encodeURIComponent(r.key)}`;
  return { title, description, alternates: { canonical: locale === "ar" ? path : `/en${path}`, languages: { ar: path, en: `/en${path}` } } };
}

const GROUPS: { key: string; pos: string[] }[] = [
  { key: "groupVerbs", pos: ["V"] },
  { key: "groupNouns", pos: ["N", "IMPN"] },
  { key: "groupAdj", pos: ["ADJ"] },
  { key: "groupProper", pos: ["PN"] },
];

export default async function RootPage({ params }: PageProps<"/[locale]/roots/[root]">) {
  const { locale, root } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("roots");
  const tl = await getTranslations("lexicon");
  const [r, surahs, sources] = await Promise.all([
    load(root),
    api<{ data: Surah[] }>("/surahs"),
    api<{ data: Source[] }>("/sources"),
  ]);
  const sourceTitle = (id: string) => {
    const s = sources.data.find((x) => x.id === id);
    return s ? (locale === "ar" ? s.title_ar : s.title_en) : id;
  };
  const grouped = GROUPS.map((g) => ({ ...g, lemmas: r.lemmas.filter((l) => g.pos.includes(l.pos)) })).filter((g) => g.lemmas.length);
  const other = r.lemmas.filter((l) => !GROUPS.some((g) => g.pos.includes(l.pos)));
  if (other.length) grouped.push({ key: "groupOther", pos: [], lemmas: other });
  const maxLemma = Math.max(...r.lemmas.map((l) => l.occurrences));

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <nav className="mb-4 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/roots" className="hover:text-t1">{t("indexTitle")}</Link>
      </nav>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="sr-only">{t("rootTitle", { root: r.spaced })}</h1>
          <p className="ar-classical px-3 text-[64px] leading-none text-root md:text-[80px]" lang="ar" aria-hidden="true">{r.spaced}</p>
          <p className="mt-3 text-[14px] text-t2" dir="ltr" lang="en">{r.translit}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/graph/root/${encodeURIComponent(r.key)}`} className="btn min-h-[40px]">
            <Icon name="graph" />
            {t("openGraph")}
          </Link>
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["statOccurrences", r.occurrences],
            ["statVerses", r.verse_count],
            ["statSurahs", r.surah_count],
            ["statLemmas", r.lemma_count],
          ] as const
        ).map(([k, n]) => (
          <div key={k} className="card p-4">
            <dd className="text-[28px] font-semibold text-t1">{formatNumber(n, locale)}</dd>
            <dt className="text-[13px] text-t2">{t(k)}</dt>
          </div>
        ))}
      </dl>
      <details className="mt-3 text-[13px] text-t2" id="counting">
        <summary className="cursor-pointer text-word">{t("howWeCount")}</summary>
        <p className="mt-2 max-w-[80ch] leading-relaxed">{t("howWeCountBody")}</p>
      </details>

      {r.lexicon.core_meaning && (
        <section className="mt-10" aria-labelledby="core-meaning">
          <h2 id="core-meaning" className="mb-2 text-[18px] font-semibold">{t("coreMeaning")}</h2>
          <blockquote className="card p-5">
            <p className="ar-classical text-[22px] leading-[2] text-t1" lang="ar">{r.lexicon.core_meaning.text}</p>
            <footer className="mt-2 text-[12.5px] text-t3">
              {`${r.lexicon.core_meaning.title_ar} — ${r.lexicon.core_meaning.author_ar}`}
              {r.lexicon.core_meaning.page_ref ? ` · ${locale === "ar" ? toArabicDigits(r.lexicon.core_meaning.page_ref) : r.lexicon.core_meaning.page_ref}` : ""}
            </footer>
          </blockquote>
        </section>
      )}

      <section className="mt-10" aria-labelledby="family">
        <h2 id="family" className="text-[18px] font-semibold">{t("family")}</h2>
        <p className="mb-4 text-[13.5px] text-t2">{t("familyLead")}</p>
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.key}>
              <h3 className="label-caps mb-2">{t(g.key)}</h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {g.lemmas.map((l) => (
                  <li key={l.id} id={`lemma-${l.id}`} className="card scroll-mt-24 p-4 target:ring-2 target:ring-ring">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="ar-classical text-[28px] leading-tight text-t1" lang="ar">{l.ar}</p>
                        <p className="mt-1 text-[12.5px] text-t3">
                          {[
                            l.verb_form ? (locale === "ar" ? `الباب ${formatNumber(l.verb_form, locale)}` : `Form ${l.verb_form}`) : null,
                            l.derivation === "ACT_PCPL" ? (locale === "ar" ? "اسم فاعل" : "active participle") : l.derivation === "PASS_PCPL" ? (locale === "ar" ? "اسم مفعول" : "passive participle") : l.derivation === "VN" ? (locale === "ar" ? "مصدر" : "verbal noun") : null,
                            locale === "en" && l.gloss_en ? l.gloss_en : null,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="text-[20px] font-semibold">{formatNumber(l.occurrences, locale)}</p>
                        <span className="mt-1 block h-1.5 w-20 overflow-hidden rounded-full bg-card-3" aria-hidden="true">
                          <span className="block h-full rounded-full" style={{ width: `${Math.max(4, (l.occurrences / maxLemma) * 100)}%`, background: "var(--chart-root)" }} />
                        </span>
                      </div>
                    </div>
                    <p className="label-caps mt-3 mb-1">{t("formsOf")}</p>
                    <FormList forms={l.forms.slice(0, 12)} locale={locale} />
                    {l.forms.length > 12 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[12.5px] text-word">
                          {t("moreForms", { n: formatNumber(l.forms.length - 12, locale) })}
                        </summary>
                        <div className="mt-2">
                          <FormList forms={l.forms.slice(12)} locale={locale} />
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 scroll-mt-24" aria-labelledby="lexicon-h" id="lexicon">
        <h2 id="lexicon-h" className="text-[18px] font-semibold">{tl("inLexicons")}</h2>
        <p className="mb-3 max-w-[80ch] text-[13.5px] text-t2">{tl("lexiconsLead")}</p>
        <RootLexicon lexicon={r.lexicon} />
      </section>

      <section className="mt-10" aria-labelledby="dist">
        <h2 id="dist" className="text-[18px] font-semibold">{t("distribution")}</h2>
        <p className="mb-3 text-[13.5px] text-t2">{t("distributionLead")}</p>
        <div className="card p-4">
          <DistributionChart rows={r.distribution} surahNames={surahs.data.map((s) => ({ number: s.number, name_ar: s.name_ar, name_translit: s.name_translit }))} />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="kwic" id="occurrences">
        <h2 id="kwic" className="text-[18px] font-semibold">{t("concordance")}</h2>
        <p className="mb-3 text-[13.5px] text-t2">{t("concordanceLead")}</p>
        <Concordance root={r.key} lemmas={r.lemmas.map((l) => ({ id: l.id, ar: l.ar, occurrences: l.occurrences }))} />
      </section>

      {(r.variants.length > 0 || r.also_attributed.length > 0) && (
        <section className="mt-10" aria-labelledby="variants">
          <h2 id="variants" className="text-[18px] font-semibold">{t("variantsTitle")}</h2>
          <p className="mb-3 max-w-[80ch] text-[13.5px] text-t2">{t("variantsLead")}</p>
          <ul className="space-y-1.5 text-[14px]">
            {r.variants.map((v) => (
              <li key={`${v.source}-${v.location}`}>
                <Link href={`/word/${v.location}`} className="hover:underline">
                  <span className="ar-classical text-[17px]" lang="ar">{v.form}</span>
                  <span className="mono mx-2 text-[11.5px] text-t3" dir="ltr">{v.location}</span>
                </Link>
                <span className="text-t2">
                  {v.other_root
                    ? t("variantOther", { source: sourceTitle(v.source), root: v.other_root.split("").join(" ") })
                    : t("variantNone", { source: sourceTitle(v.source) })}
                </span>
              </li>
            ))}
            {r.also_attributed.map((v) => (
              <li key={`also-${v.source}-${v.location}`}>
                <Link href={`/word/${v.location}`} className="hover:underline">
                  <span className="ar-classical text-[17px]" lang="ar">{v.form}</span>
                  <span className="mono mx-2 text-[11.5px] text-t3" dir="ltr">{v.location}</span>
                </Link>
                <span className="text-t2">{t("alsoLine", { source: sourceTitle(v.source), corpus: v.corpus_root ? v.corpus_root.split("").join(" ") : "—" })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FormList({ forms, locale }: { forms: { form: string; occurrences: number; sample: string }[]; locale: string }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {forms.map((f) => (
        <li key={f.form}>
          <Link href={`/word/${f.sample}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-0.5 hover:border-ring">
            <span className="ar-classical text-[16px]" lang="ar">{f.form}</span>
            <span className="mono text-[11px] text-t3">{formatNumber(f.occurrences, locale)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
