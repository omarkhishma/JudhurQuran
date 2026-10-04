import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Explanations } from "@/components/hadith/Explanations";
import { RecordPlace } from "@/components/library/RecordPlace";
import { Grades } from "@/components/hadith/Grades";
import { HadithText } from "@/components/hadith/HadithText";
import { Sources } from "@/components/hadith/Sources";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cnt, formatNumber } from "@/lib/format";
import { type Collection, type HadithRecord, hadithHref, isCollection, kitabHref, narratorHref, refOfPath, refText, unnumbered } from "@/lib/hadith";
import { localized, snippet } from "@/lib/seo";

export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

async function load(slug: string, raw: string) {
  if (!isCollection(slug)) notFound();
  const ref = refOfPath(raw);
  if (!/^s?\d+(\.\d+)?$/.test(ref)) notFound();
  const [c, r] = await Promise.all([api<Collection>(`/texts/${slug}`), api<HadithRecord>(`/texts/${slug}/passages/${encodeURIComponent(ref)}`)]);
  return { c, r };
}

function pct(x: number, locale: string) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent", maximumFractionDigits: 0 }).format(x);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/hadith/[collection]/[ref]">): Promise<Metadata> {
  const { locale, collection, ref } = await params;
  const { c, r } = await load(collection, ref);
  const t = await getTranslations({ locale, namespace: "hadith" });
  const book = locale === "ar" ? c.title_ar : c.title_en;
  const matn = r.parts?.matn ? r.ar_full.slice(r.parts.matn[0], r.parts.matn[1]) : r.ar_full;
  return {
    title: t("hadithTitle", { collection: book, ref: refText(r.ref, locale) }),
    description: snippet(matn.replace(/[‏‎"]/g, "")),
    alternates: localized(locale, hadithHref(collection, r.ref)),
  };
}

/** A hadith (P11.2): its place in its collection, its text verbatim told into isnād, matn and comment (by rule, said
 * so), every word open to its reading, the men of its isnād linked to their entries or left with their candidates,
 * the graders' rulings under their names, al-Tirmidhī's own words, and HadeethEnc's explanation where it cites this
 * number — each with its source. */
export default async function HadithPage({ params }: PageProps<"/[locale]/hadith/[collection]/[ref]">) {
  const { locale, collection, ref } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hadith");
  const { c, r } = await load(collection, ref);
  const ar = locale === "ar";
  const book = ar ? c.title_ar : c.title_en;
  const number = unnumbered(r.ref) ? t("unnumbered", { n: formatNumber(r.meta.sequence, locale) }) : t("hadithN", { ref: refText(r.ref, locale) });
  const kitab = r.path[0];
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10">
      <JsonLd
        data={breadcrumbs(locale, [
          [ar ? "الرئيسية" : "Home", "/"],
          [t("homeTitle"), "/hadith"],
          [book, `/hadith/${c.slug}`],
          ...r.path.map((p) => [p.title_ar, kitabHref(c.slug, p.ordinal)] as [string, string]),
          [number, hadithHref(c.slug, r.ref)],
        ])}
      />
      <nav className="mb-4 flex flex-wrap items-center gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/hadith" className="hover:text-t1">{t("homeTitle")}</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/hadith/${c.slug}`} className="hover:text-t1">{book}</Link>
        {r.path.slice(0, 1).map((p) => (
          <span key={p.ordinal} className="contents">
            <span aria-hidden="true">›</span>
            <Link href={kitabHref(c.slug, p.ordinal)} className="ar-classical hover:text-t1" lang="ar">{p.title_ar}</Link>
          </span>
        ))}
      </nav>
      <header className="mb-5 flex flex-col gap-2">
        <h1 className="text-[24px] font-semibold">{t("hadithTitle", { collection: book, ref: unnumbered(r.ref) ? number : refText(r.ref, locale) })}</h1>
        {kitab && <p className="ar-classical text-[18px] text-t2" lang="ar" dir="rtl">{r.path.map((p) => p.title_ar).join(" — ")}</p>}
        <p className="flex flex-wrap items-center gap-2 text-[12.5px]">
          {r.parts && <span className="state-chip" title={t("autoSplitNote")}>{t("autoSplit")}</span>}
          <span className="text-t3">{t("numbering", { numbering: (ar ? c.meta_ar : c.meta_en) ?? "" })}</span>
        </p>
      </header>

      {r.meta.empty ? (
        <div className="card p-4 text-[14px] text-t2">
          <p>{t("emptyRecord")}</p>
          {r.meta.witness && <p className="mt-1 text-[13px] text-t3">{t("emptyWitness", { n: formatNumber(r.meta.witness.number, locale) })}</p>}
        </div>
      ) : (
        <>
          {!r.parts && <p className="mb-3 text-[12.5px] text-t3">{t("noSplit")}</p>}
          {r.parts && !r.parts.matn && <p className="mb-3 text-[12.5px] text-t3">{t("chainOnly")}</p>}
          <HadithText text={c.slug} segments={r.segments} words={r.words} forms={r.forms} chain={r.narrators} place={{ href: hadithHref(c.slug, r.ref), label: `${book} ${unnumbered(r.ref) ? number : refText(r.ref, locale)}` }} />
        </>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {r.narrators.length > 0 && (
          <section aria-labelledby="chain-h">
            <h2 id="chain-h" className="mb-2 text-[17px] font-semibold">{t("chainTitle")}</h2>
            <ol className="flex flex-col gap-1.5">
              {r.narrators.map((n) => (
                <li key={n.ordinal} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border border-line bg-card px-3 py-2">
                  <span className="ar-classical text-[17px]" lang="ar" dir="rtl">
                    {n.narrator ? <Link href={narratorHref(n.narrator.id)} className="hover:text-root">{n.text}</Link> : n.text}
                  </span>
                  {n.narrator ? (
                    <span className="text-[12px] text-t3">
                      <bdi lang="ar" className="line-clamp-1 inline" title={n.narrator.name}>{n.narrator.name.split(" ").slice(0, 8).join(" ")}{n.narrator.name.split(" ").length > 8 ? "…" : ""}</bdi> • {t("linkAuto", { c: pct(n.confidence, locale) })}
                    </span>
                  ) : (
                    <span className="text-[12px] text-t3">{n.candidates > 0 ? t("linkOpen", cnt(n.candidates, locale)) : t("linkNone")}</span>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[12px] leading-relaxed text-t3">{t("chainNote")}</p>
          </section>
        )}
        <div className="flex flex-col gap-8">
          {r.meta.grades.length > 0 && (
            <section aria-labelledby="grades-h">
              <h2 id="grades-h" className="mb-2 text-[17px] font-semibold">{t("gradesTitle")}</h2>
              <Grades grades={r.meta.grades} />
            </section>
          )}
          {r.meta.verdict && (
            <section aria-labelledby="verdict-h">
              <h2 id="verdict-h" className="mb-2 text-[17px] font-semibold">{t("verdictTitle")}</h2>
              <p className="ar-classical text-[19px]" lang="ar" dir="rtl">«{r.meta.verdict}»</p>
            </section>
          )}
        </div>
      </div>

      <Explanations items={r.explanations} />

      <nav className="mt-10 flex flex-wrap gap-2" aria-label={number}>
        {r.prev && <Link href={hadithHref(c.slug, r.prev)} className="btn" rel="prev">{t("prev")}</Link>}
        {r.next && <Link href={hadithHref(c.slug, r.next)} className="btn" rel="next">{t("next")}</Link>}
      </nav>
      <Sources sources={[r.source, c.titles_source, r.narrators_source, r.explanations_source]} />
      <RecordPlace text={`hadith:${c.slug}`} chapter={kitab?.ordinal ?? 0} at={r.ref} label={kitab?.title_ar ?? ""} />
    </div>
  );
}

