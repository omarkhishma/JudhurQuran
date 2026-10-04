import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sources } from "@/components/hadith/Sources";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { bookHref } from "@/lib/books";
import { cnt, formatNumber, toArabicDigits } from "@/lib/format";
import type { Source } from "@/lib/hadith";
import { localized } from "@/lib/seo";

// read from ?q, ?century and ?page: rendered for each request, the API answers from its cache
export const dynamic = "force-dynamic";
const PAGE = 40;

type Work = {
  id: number;
  version: string;
  death_ah: number;
  before_islam: boolean;
  era_year: number | null;
  title_ar: string;
  title_lat: string | null;
  author_ar: string;
  author_lat: string | null;
  words: number;
  categories: string[];
  library: string;
  library_id: string;
  shelf: string | null;
  links: { openiti: string; shamela?: string; turath?: string };
};
type Catalogue = { data: Work[]; total: number; all: number; centuries: { century: number; n: number }[]; source: Source | null };

type Query = { q: string; century: number | null; page: number };

function read(sp: { [k: string]: string | string[] | undefined }): Query {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const c = Number(one("century"));
  return {
    q: one("q").slice(0, 100),
    century: one("century") !== "" && Number.isInteger(c) && c >= 0 && c <= 14 ? c : null,
    page: Math.max(1, Number(one("page")) || 1),
  };
}

function href({ q, century, page }: Query) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (century !== null) p.set("century", String(century));
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return `/books/catalogue${s ? `?${s}` : ""}`;
}

async function load(query: Query) {
  const p = new URLSearchParams({ offset: String((query.page - 1) * PAGE), limit: String(PAGE) });
  if (query.q) p.set("q", query.q);
  if (query.century !== null) p.set("century", String(query.century));
  return api<Catalogue>(`/catalogue?${p}`);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/books/catalogue">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "books" });
  return { title: t("catalogueTitle"), description: t("catalogueLead"), alternates: localized(locale, "/books/catalogue") };
}

/** The catalogue (P11.3a): every work the D9 gate lets in, as OpenITI's metadata gives it — found by its title or
 * author, browsed by the century its author died in; each with where its text is read: here for the shelf's books,
 * in OpenITI's release for all, on shamela.ws and turath where its id is Shamela's. */
export default async function CataloguePage({ params, searchParams }: PageProps<"/[locale]/books/catalogue">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("books");
  const query = read(await searchParams);
  const c = await load(query);
  const ar = locale === "ar";
  const digits = (n: number) => (ar ? toArabicDigits(n) : String(n));
  const pages = Math.max(1, Math.ceil(c.total / PAGE));
  const centuryName = (n: number) => (n === 0 ? t("beforeIslam") : t("century", { n: digits(n) }));
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[ar ? "الرئيسية" : "Home", "/"], [t("homeTitle"), "/books"], [t("catalogueTitle"), "/books/catalogue"]])} />
      <nav className="mb-4 flex flex-wrap gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/books" className="hover:text-t1">{t("homeTitle")}</Link>
      </nav>
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold">{t("catalogueTitle")}</h1>
        <p className="max-w-[75ch] leading-relaxed text-t2">{t("catalogueLead")}</p>
      </header>
      <form action={ar ? "/books/catalogue" : "/en/books/catalogue"} method="get" role="search" className="mb-5 flex max-w-[560px] flex-wrap gap-2">
        <label htmlFor="cat-q" className="sr-only">{t("catalogueSearch")}</label>
        <input id="cat-q" name="q" defaultValue={query.q} dir="rtl" lang="ar" className="field min-w-0 flex-1 text-[16px]" placeholder={t("cataloguePlaceholder")} />
        {query.century !== null && <input type="hidden" name="century" value={query.century} />}
        <button type="submit" className="btn btn-primary">{t("searchGo")}</button>
      </form>
      <nav aria-label={t("centuryLabel")} className="mb-6 flex flex-wrap gap-2">
        <Link href={href({ ...query, century: null, page: 1 })} className={`chip${query.century === null ? " is-on" : ""}`} aria-current={query.century === null ? "page" : undefined}>
          {t("filterAll")} <span className="text-t3">{formatNumber(c.centuries.reduce((a, x) => a + x.n, 0), locale)}</span>
        </Link>
        {c.centuries.map((x) => (
          <Link key={x.century} href={href({ ...query, century: x.century, page: 1 })} className={`chip${query.century === x.century ? " is-on" : ""}`} aria-current={query.century === x.century ? "page" : undefined}>
            {centuryName(x.century)} <span className="text-t3">{formatNumber(x.n, locale)}</span>
          </Link>
        ))}
      </nav>
      <p className="mb-3 text-[13px] text-t3" aria-live="polite">{t("catalogueFound", cnt(c.total, locale))}</p>
      <ol className="flex flex-col divide-y divide-line rounded-xl border border-line bg-card">
        {c.data.map((w) => (
          <li key={w.id} className="flex flex-col gap-1.5 px-4 py-3" data-work={w.version}>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {w.shelf ? (
                <Link href={bookHref(w.shelf)} className="ar-classical text-[19px] leading-snug text-root hover:underline" lang="ar" dir="rtl">{w.title_ar}</Link>
              ) : (
                <span className="ar-classical text-[19px] leading-snug" lang="ar" dir="rtl">{w.title_ar}</span>
              )}
              <span className="text-[12.5px] text-t2">
                <bdi lang="ar">{w.author_ar}</bdi> {w.before_islam ? `(${t("beforeIslam")})` : ar ? `(ت ${digits(w.death_ah)}هـ)` : `(d. ${w.death_ah} AH)`}
              </span>
            </p>
            <p className="flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="state-chip">{t("words", cnt(w.words, locale))}</span>
              {w.categories.slice(0, 3).map((k) => (
                <span key={k} className="state-chip" lang="ar">{k}</span>
              ))}
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
              {w.shelf && <Link href={bookHref(w.shelf)} className="font-semibold text-ring hover:underline">{t("readHere")}</Link>}
              <a href={w.links.openiti} className="text-ring hover:underline" rel="noopener noreferrer" target="_blank">{t("readOpenITI")}</a>
              {w.links.shamela && <a href={w.links.shamela} className="text-ring hover:underline" rel="noopener noreferrer" target="_blank">{t("readShamela")}</a>}
              {w.links.turath && <a href={w.links.turath} className="text-ring hover:underline" rel="noopener noreferrer" target="_blank">{t("readTurath")}</a>}
              <bdi dir="ltr" className="font-mono text-[11px] text-t3">{w.library_id}</bdi>
            </p>
          </li>
        ))}
      </ol>
      {c.total === 0 && <p className="mt-4 text-[14px] text-t3">{t("catalogueNone")}</p>}
      <nav className="mt-6 flex flex-wrap items-center gap-2" aria-label={t("pageOf", { page: formatNumber(query.page, locale), pages: formatNumber(pages, locale) })}>
        {query.page > 1 && <Link href={href({ ...query, page: query.page - 1 })} className="btn">{t("prevPage")}</Link>}
        {pages > 1 && <span className="text-[12.5px] text-t3">{t("pageOf", { page: formatNumber(query.page, locale), pages: formatNumber(pages, locale) })}</span>}
        {query.page < pages && <Link href={href({ ...query, page: query.page + 1 })} className="btn">{t("nextPage")}</Link>}
      </nav>
      <p className="mt-6 max-w-[80ch] text-[12.5px] leading-relaxed text-t3">{t("catalogueGate", { all: formatNumber(c.all, locale) })}</p>
      <Sources sources={[c.source]} />
    </div>
  );
}
