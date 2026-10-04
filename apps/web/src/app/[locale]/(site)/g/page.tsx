import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { cnt, formatNumber } from "@/lib/format";
import { PublishedCard } from "@/components/graph/PublishedCard";
import { loadGallery } from "@/lib/publishedServer";
import { localized } from "@/lib/seo";

// the latest maps first: a page published a minute ago is on it
export const dynamic = "force-dynamic";
const PAGE = 24;

export async function generateMetadata({ params }: PageProps<"/[locale]/g">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "graph" });
  return { title: t("publishedGallery"), description: t("publishedGalleryLead"), alternates: localized(locale, "/g") };
}

/** The published maps, the latest first (HUB-25, P8.5): each with its author, its counts and when it was last
 * published; a page at a time — searched by title, author or root, or those holding one root (B60). */
export default async function PublishedGalleryPage({ params, searchParams }: PageProps<"/[locale]/g">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("graph");
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const page = Math.max(1, Math.min(10_000, Number(one("page")) || 1));
  const q = one("q").trim().slice(0, 80);
  const root = one("root").trim().slice(0, 20);
  const got = await loadGallery((page - 1) * PAGE, PAGE, undefined, root ? { root } : q ? { q } : {});
  const pages = Math.max(1, Math.ceil(got.total / PAGE));
  // the page's own address with the search kept
  const at = (p: number) => `/g?${new URLSearchParams({ ...(root ? { root } : q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;
  const spaced = (k: string) => [...k].join(" ");
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[t("publishedGallery"), "/g"]])} />
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold">{t("publishedGallery")}</h1>
        <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-t2">{t("publishedGalleryLead")}</p>
        <form action="" method="get" role="search" className="flex flex-wrap items-center gap-2" aria-label={t("gallerySearch")}>
          <input type="search" name="q" defaultValue={root ? "" : q} placeholder={t("gallerySearchLabel")} aria-label={t("gallerySearchLabel")} className="field min-w-0 flex-1 sm:max-w-[420px]" dir="auto" maxLength={80} />
          <button type="submit" className="btn">{t("gallerySearchGo")}</button>
        </form>
        {(root || q) && (
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-t2">
            <span>{root ? t("galleryRoot", { root: spaced(got.root ?? root) }) : t("galleryQuery", { q })}</span>
            <Link href="/g" className="text-ring hover:underline">{t("galleryClear")}</Link>
          </p>
        )}
        <p className="text-[12.5px] text-t3" aria-live="polite">{t("publishedGalleryCount", cnt(got.total, locale))}</p>
      </header>
      {got.data.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {got.data.map((m) => (
            <li key={m.slug}>
              <PublishedCard m={m} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-card p-5">
          <p className="text-[14px] text-t2">{t("publishedGalleryEmpty")}</p>
          <Link href="/graph" className="btn btn-primary">{t("publishedFromEditor")}</Link>
        </div>
      )}
      {pages > 1 && (
        <nav className="mt-6 flex flex-wrap items-center gap-2" aria-label={t("publishedPageOf", { page: formatNumber(page, locale), pages: formatNumber(pages, locale) })}>
          {page > 1 && <Link href={at(page - 1)} className="btn">{t("publishedPrev")}</Link>}
          <span className="text-[12.5px] text-t3">{t("publishedPageOf", { page: formatNumber(page, locale), pages: formatNumber(pages, locale) })}</span>
          {page < pages && <Link href={at(page + 1)} className="btn">{t("publishedNext")}</Link>}
        </nav>
      )}
    </div>
  );
}
