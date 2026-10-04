import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { cnt, formatNumber } from "@/lib/format";
import { publishedPath } from "@/lib/graph/publishedShared";
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
 * published; a page at a time. */
export default async function PublishedGalleryPage({ params, searchParams }: PageProps<"/[locale]/g">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("graph");
  const raw = (await searchParams).page;
  const page = Math.max(1, Math.min(10_000, Number(Array.isArray(raw) ? raw[0] : raw) || 1));
  const got = await loadGallery((page - 1) * PAGE, PAGE);
  const pages = Math.max(1, Math.ceil(got.total / PAGE));
  const day = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[t("publishedGallery"), "/g"]])} />
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold">{t("publishedGallery")}</h1>
        <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-t2">{t("publishedGalleryLead")}</p>
        <p className="text-[12.5px] text-t3" aria-live="polite">{t("publishedGalleryCount", cnt(got.total, locale))}</p>
      </header>
      {got.data.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {got.data.map((m) => (
            <li key={m.slug}>
              <Link href={publishedPath(m.slug)} className="pub-row flex h-full flex-col gap-1.5 rounded-xl border border-line bg-card p-4 hover:border-line-2">
                <span className="flex items-baseline gap-2">
                  {m.counts.lead && <span className="ar-classical text-[18px] text-t1" lang="ar">{m.counts.lead}</span>}
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold" dir="auto">{m.title}</span>
                </span>
                {m.description && <span className="line-clamp-2 text-[13px] leading-relaxed text-t2" dir="auto">{m.description}</span>}
                <span className="mt-auto text-[12px] text-t3">
                  {[m.author.name ? t("publishedBy", { name: m.author.name }) : t("publishedAnonymousAr"), day(m.updated_at), t("cards", cnt(m.counts.cards, locale)), t("publishedForks", cnt(m.fork_count, locale))].join(" · ")}
                </span>
              </Link>
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
          {page > 1 && <Link href={`/g?page=${page - 1}`} className="btn">{t("publishedPrev")}</Link>}
          <span className="text-[12.5px] text-t3">{t("publishedPageOf", { page: formatNumber(page, locale), pages: formatNumber(pages, locale) })}</span>
          {page < pages && <Link href={`/g?page=${page + 1}`} className="btn">{t("publishedNext")}</Link>}
        </nav>
      )}
    </div>
  );
}
