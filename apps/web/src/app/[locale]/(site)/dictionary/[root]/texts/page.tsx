import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { RootInMyTexts } from "@/components/rootlife/RootInMyTexts";
import { KwicRow } from "@/components/rootlife/RootInTexts";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { dictHref } from "@/lib/dictionary";
import { cnt, formatNumber } from "@/lib/format";
import { type Query, type RootInTexts, type Which, rootTextsHref } from "@/lib/rootlife";
import { localized } from "@/lib/seo";

// read from ?kind, ?text, ?which and ?page: rendered for each request, the API answers from its cache
export const dynamic = "force-dynamic";
const PAGE = 40;

function read(sp: { [k: string]: string | string[] | undefined }): Query {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const kind = one("kind");
  const which = one("which");
  return {
    kind: kind === "hadith" || kind === "book" ? kind : null,
    text: /^[a-z0-9-]{3,80}$/.test(one("text")) ? one("text") : null,
    which: which === "possible" || which === "all" ? (which as Which) : "sure",
    page: Math.max(1, Number(one("page")) || 1),
  };
}

async function load(raw: string, q: Query) {
  const p = new URLSearchParams({ which: q.which, offset: String((q.page - 1) * PAGE), limit: String(PAGE) });
  if (q.kind) p.set("kind", q.kind);
  if (q.text) p.set("text", q.text);
  const key = decodeURIComponent(raw);
  if (key.length > 20) notFound();
  return api<RootInTexts>(`/roots/${encodeURIComponent(key)}/texts?${p}`);
}

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/dictionary/[root]/texts">): Promise<Metadata> {
  const { locale, root } = await params;
  const q = read(await searchParams);
  const d = await load(root, q);
  const t = await getTranslations({ locale, namespace: "rootTexts" });
  return { title: t("pageTitle", { root: d.root.display }), description: t("lead"), alternates: localized(locale, rootTextsHref(d.root.key, q)) };
}

/** Every passage of the hadith and the books holding a root (P11.4b), a page at a time — by kind, by text, the
 * sure, the possible or both — each with the root's word in its report, linked to where it is read. */
export default async function RootTextsPage({ params, searchParams }: PageProps<"/[locale]/dictionary/[root]/texts">) {
  const { locale, root } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("rootTexts");
  const q = read(await searchParams);
  const d = await load(root, q);
  const ar = locale === "ar";
  const key = d.root.key;
  const pages = Math.max(1, Math.ceil(d.total / PAGE));
  const texts = d.counts.filter((c) => !q.kind || c.kind === q.kind);
  const chip = (on: boolean) => `chip${on ? " is-on" : ""}`;
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[ar ? "الرئيسية" : "Home", "/"], [d.root.display, dictHref(key)], [t("pageTitle", { root: d.root.display }), rootTextsHref(key)]])} />
      <nav className="mb-4 flex flex-wrap gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/dictionary" className="hover:text-t1">{t("dictionary")}</Link>
        <span aria-hidden="true">›</span>
        <Link href={dictHref(key)} className="ar-classical hover:text-t1" lang="ar">{d.root.display}</Link>
      </nav>
      <header className="mb-5 flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold">{t("pageTitle", { root: d.root.display })}</h1>
        <p className="max-w-[75ch] text-[13px] leading-relaxed text-t3">{t("lead")}</p>
      </header>
      <div className="mb-3 flex flex-col gap-2">
        <nav aria-label={t("kindLabel")} className="flex flex-wrap gap-2">
          <Link href={rootTextsHref(key, { ...q, kind: null, text: null, page: 1 })} className={chip(!q.kind)} aria-current={!q.kind ? "page" : undefined}>{t("kindAll")}</Link>
          <Link href={rootTextsHref(key, { ...q, kind: "hadith", text: null, page: 1 })} className={chip(q.kind === "hadith")} aria-current={q.kind === "hadith" ? "page" : undefined}>{t("inHadith")}</Link>
          <Link href={rootTextsHref(key, { ...q, kind: "book", text: null, page: 1 })} className={chip(q.kind === "book")} aria-current={q.kind === "book" ? "page" : undefined}>{t("inBooks")}</Link>
        </nav>
        <nav aria-label={t("whichLabel")} className="flex flex-wrap gap-2">
          {(["sure", "possible", "all"] as const).map((w) => (
            <Link key={w} href={rootTextsHref(key, { ...q, which: w, page: 1 })} className={chip(q.which === w)} aria-current={q.which === w ? "page" : undefined}>
              {t(`which_${w}`)}
            </Link>
          ))}
        </nav>
        {texts.length > 1 && (
          <details className="rounded-lg border border-line bg-card px-3 py-2" open={texts.length <= 8 || !!q.text}>
            <summary className="cursor-pointer text-[13px]">
              {t("textLabel")}: <span lang="ar">{q.text ? (texts.find((c) => c.slug === q.text)?.title_ar ?? q.text) : t("textAll")}</span>
            </summary>
            <nav aria-label={t("textLabel")} className="mt-2 flex flex-wrap gap-1.5">
              <Link href={rootTextsHref(key, { ...q, text: null, page: 1 })} className={chip(!q.text)} aria-current={!q.text ? "page" : undefined}>{t("textAll")}</Link>
              {texts.map((c) => {
                const n = q.which === "sure" ? c.sure : q.which === "possible" ? c.possible : c.sure + c.possible;
                if (!n) return null;
                return (
                  <Link key={c.slug} href={rootTextsHref(key, { ...q, text: c.slug, page: 1 })} className={chip(q.text === c.slug)} aria-current={q.text === c.slug ? "page" : undefined} lang="ar">
                    {c.title_ar} <span className="text-t3">{formatNumber(n, locale)}</span>
                  </Link>
                );
              })}
            </nav>
          </details>
        )}
      </div>
      <p className="mb-3 text-[13px] text-t3" aria-live="polite">{t("found", cnt(d.total, locale))}</p>
      {d.data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {d.data.map((h) => (
            <KwicRow key={h.uri} h={h} />
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-t2">{t("none")}</p>
      )}
      <nav className="mt-6 flex flex-wrap items-center gap-2" aria-label={t("pageOf", { page: formatNumber(q.page, locale), pages: formatNumber(pages, locale) })}>
        {q.page > 1 && <Link href={rootTextsHref(key, { ...q, page: q.page - 1 })} className="btn">{t("prevPage")}</Link>}
        {pages > 1 && <span className="text-[12.5px] text-t3">{t("pageOf", { page: formatNumber(q.page, locale), pages: formatNumber(pages, locale) })}</span>}
        {q.page < pages && <Link href={rootTextsHref(key, { ...q, page: q.page + 1 })} className="btn">{t("nextPage")}</Link>}
      </nav>
      {/* the reader's own texts, read in this browser (P4.4) */}
      <RootInMyTexts dictKey={key} />
    </div>
  );
}
