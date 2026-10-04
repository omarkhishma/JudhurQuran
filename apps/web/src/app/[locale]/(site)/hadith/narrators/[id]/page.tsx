import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sources } from "@/components/hadith/Sources";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cnt, formatNumber, toArabicDigits } from "@/lib/format";
import { type Narrator, type TextHit, hadithHref, narratorHref, refText } from "@/lib/hadith";
import { localized, snippet } from "@/lib/seo";

// a page of a list is read from ?page (or ?q): rendered for each request, the API answers it from its cache
export const dynamic = "force-dynamic";
const PAGE = 20;


async function load(raw: string, page: number) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1 || page < 1) notFound();
  const [n, h] = await Promise.all([
    api<Narrator>(`/narrators/${id}`),
    api<{ total: number; data: TextHit[] }>(`/narrators/${id}/hadith?offset=${(page - 1) * PAGE}&limit=${PAGE}`),
  ]);
  return { n, h };
}

const pageOf = (sp: { [k: string]: string | string[] | undefined }) => Math.max(1, Number(sp.page ?? 1) || 1);

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/hadith/narrators/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const { n } = await load(id, pageOf(await searchParams));
  return { title: n.name, description: snippet(n.text), alternates: localized(locale, narratorHref(n.id)) };
}

/** A narrator (P11.2b): Ibn Ḥajar's entry verbatim; what his own rules read from it, each beside his introduction's
 * words; the books that narrate from him; his teachers and students as the linked chains show them; his hadith here. */
export default async function NarratorPage({ params, searchParams }: PageProps<"/[locale]/hadith/narrators/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const page = pageOf(await searchParams);
  const t = await getTranslations("hadith");
  const { n, h } = await load(id, page);
  const ar = locale === "ar";
  const pages = Math.max(1, Math.ceil(h.total / PAGE));
  const neighbours = (title: string, list: Narrator["narrates_from"]) =>
    list.length > 0 && (
      <section>
        <h3 className="mb-2 text-[15px] font-semibold">{title}</h3>
        <ul className="flex flex-col gap-1">
          {list.map((x) => (
            <li key={x.id} className="flex items-baseline gap-2">
              <Link href={narratorHref(x.id)} className="ar-classical line-clamp-1 text-[16px] hover:text-root" lang="ar" dir="rtl" title={x.name}>{x.name}</Link>
              <span className="text-[11.5px] text-t3">{t("inRecords", cnt(x.records, locale))}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[ar ? "الرئيسية" : "Home", "/"], [t("homeTitle"), "/hadith"], [t("narratorsTitle"), "/hadith/narrators"], [n.name, narratorHref(n.id)]])} />
      <nav className="mb-4 flex flex-wrap gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/hadith" className="hover:text-t1">{t("homeTitle")}</Link>
        <span aria-hidden="true">›</span>
        <Link href="/hadith/narrators" className="hover:text-t1">{t("narratorsTitle")}</Link>
      </nav>
      <header className="mb-6 flex flex-col gap-3">
        <h1 className="ar-classical text-[30px] leading-snug" lang="ar" dir="rtl">{n.name}</h1>
        <figure className="card flex flex-col gap-2 p-4">
          <blockquote className="ar-classical text-[18px] leading-loose" lang="ar" dir="rtl">{n.text}</blockquote>
          <figcaption className="text-[12.5px] text-t3">{t("narratorEntry", { n: ar ? toArabicDigits(n.number ?? 0) : String(n.number ?? 0) })}</figcaption>
        </figure>
      </header>

      <section aria-labelledby="read-h" className="mb-8">
        <h2 id="read-h" className="mb-3 text-[17px] font-semibold">{t("narratorRead")}</h2>
        <dl className="grid gap-3 md:grid-cols-3">
          {n.read.rank && (
            <div className="card flex flex-col gap-1.5 p-3">
              <dt className="text-[14px] font-semibold">{t("rank", { n: formatNumber(n.read.rank, locale) })}{n.verdict && <> — <bdi lang="ar">{n.verdict}</bdi></>}</dt>
              {n.read.rank_def && <dd className="ar-classical text-[15px] leading-relaxed text-t2" lang="ar" dir="rtl">{n.read.rank_def}</dd>}
            </div>
          )}
          {n.read.tabaqa && (
            <div className="card flex flex-col gap-1.5 p-3">
              <dt className="text-[14px] font-semibold">{n.read.tabaqa === 1 && n.read.tabaqa_rule === "companion" ? t("tabaqaCompanion") : t("tabaqa", { n: formatNumber(n.read.tabaqa, locale) })}</dt>
              {n.read.tabaqa_def && <dd className="ar-classical text-[15px] leading-relaxed text-t2" lang="ar" dir="rtl">{n.read.tabaqa_def}</dd>}
            </div>
          )}
          {n.read.death_ah && (
            <div className="card flex flex-col gap-1.5 p-3">
              <dt className="text-[14px] font-semibold">{t("death", { year: formatNumber(n.read.death_ah, locale) })}</dt>
              {n.death_text && <dd className="ar-classical text-[15px] text-t2" lang="ar" dir="rtl">«{n.death_text}»</dd>}
              {n.read.death_def && <dd className="text-[12.5px] text-t3">{t("deathByRule")}: <span className="ar-classical text-[14px]" lang="ar">{n.read.death_def}</span></dd>}
            </div>
          )}
        </dl>
      </section>

      {n.sigla.length > 0 && (
        <section aria-labelledby="sigla-h" className="mb-8">
          <h2 id="sigla-h" className="mb-2 text-[17px] font-semibold">{t("siglaTitle")}</h2>
          <ul className="flex flex-wrap gap-1.5 text-[13px]">
            {n.sigla.map((s) => (
              <li key={s.siglum} className="state-chip" lang="ar">
                <bdi>{s.siglum}</bdi>{s.book_ar && <> — {s.book_ar}</>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(n.narrates_from.length > 0 || n.narrated_by.length > 0) && (
        <section className="mb-8 flex flex-col gap-3">
          <div className="grid gap-6 md:grid-cols-2">
            {neighbours(t("narratesFrom"), n.narrates_from)}
            {neighbours(t("narratedBy"), n.narrated_by)}
          </div>
          <p className="text-[12px] text-t3">{t("neighboursNote")}</p>
        </section>
      )}

      {h.total > 0 && (
        <section aria-labelledby="records-h">
          <h2 id="records-h" className="mb-2 text-[17px] font-semibold">{t("recordsTitle")}</h2>
          <p className="mb-3 flex flex-wrap gap-1.5 text-[12.5px]">
            {n.records.map((r) => (
              <span key={r.slug} className="state-chip">
                {ar ? r.title_ar : r.title_en}: {formatNumber(r.records, locale)}
              </span>
            ))}
          </p>
          <ul className="flex flex-col gap-2">
            {h.data.map((x) => (
              <li key={x.uri}>
                <Link href={hadithHref(x.text.slug, x.ref)} className="card flex flex-col gap-1 p-3 hover:border-root">
                  <span className="text-[12.5px] font-semibold text-ring">
                    {ar ? x.text.title_ar : x.text.title_en}{ar ? "، " : ", "}{t("hadithN", { ref: refText(x.ref, locale) })}
                  </span>
                  <span className="ar-classical text-[15px] leading-relaxed text-t2" lang="ar" dir="rtl">{x.start}…</span>
                </Link>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav className="mt-4 flex flex-wrap items-center gap-2" aria-label={t("pageOf", { page: formatNumber(page, locale), pages: formatNumber(pages, locale) })}>
              {page > 1 && <Link href={`${narratorHref(n.id)}${page > 2 ? `?page=${page - 1}` : ""}`} className="btn">{t("prevPage")}</Link>}
              <span className="text-[12.5px] text-t3">{t("pageOf", { page: formatNumber(page, locale), pages: formatNumber(pages, locale) })}</span>
              {page < pages && <Link href={`${narratorHref(n.id)}?page=${page + 1}`} className="btn">{t("nextPage")}</Link>}
            </nav>
          )}
        </section>
      )}
      <Sources sources={[n.source]} />
    </div>
  );
}
