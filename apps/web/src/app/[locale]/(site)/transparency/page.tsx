import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";

export const revalidate = 3600;

type Layer = { id: string; group?: string; title_ar?: string; title_en?: string; count: number; of: number; how: "source" | "rule"; disagree?: number; detail?: Record<string, unknown> };
type Report = { version: string | null; layers: Layer[]; review: Record<string, number>; signed: number };

export async function generateMetadata({ params }: PageProps<"/[locale]/transparency">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transparency" });
  return { title: t("title"), description: t("lead", { version: "" }).trim(), alternates: localized(locale, "/transparency") };
}

// the layers whose making is said under them (the lexica and the tafsir are their authors', named on /sources)
const WHAT = ["text", "roots", "patterns", "gharib", "topics", "hadith-split", "narrators", "book-pages"];
const pct = (x: number, locale: string) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent", maximumFractionDigits: 1 }).format(x);

/**
 * What we know and what we do not yet (B17): every layer of the data with the share of the text it covers, whether a
 * source gave it or our rules derived it, where the sources disagree, what waits on review, and what the experts have
 * signed — none yet, said plainly. The numbers are the API's, counted from the loaded data each hour.
 */
export default async function TransparencyPage({ params }: PageProps<"/[locale]/transparency">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("transparency");
  const d = await api<Report>("/transparency");
  const ar = locale === "ar";
  const n = (x: number) => formatNumber(x, locale);
  const name = (l: Layer) => (l.title_ar ? (ar ? l.title_ar : (l.title_en ?? l.title_ar)) : t(`layer.${l.id}`));
  const row = (l: Layer) => (
    <li key={l.id} className="flex flex-col gap-1.5 border-t border-line py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[14px] font-medium" dir="auto">{name(l)}</h3>
        <span className={"state-chip text-[11.5px]" + (l.how === "rule" ? " is-rule" : "")}>{t(l.how === "rule" ? "byRule" : "bySource")}</span>
        <span className="ms-auto text-[13px] text-t2">{t("countOf", { count: n(l.count), of: n(l.of), pct: pct(l.count / Math.max(1, l.of), locale) })}</span>
      </div>
      <div className="transparency-bar" aria-hidden="true">
        <span style={{ width: `${(100 * l.count) / Math.max(1, l.of)}%` }} />
      </div>
      {WHAT.includes(l.id) && <p className="text-[12.5px] leading-relaxed text-t3">{t(`what.${l.id}`)}</p>}
      {!!l.disagree && <p className="text-[12.5px] text-t2">{t("disagree", { n: n(l.disagree) })}</p>}
    </li>
  );
  const groups: [string, Layer[]][] = [
    [t("group.quran"), d.layers.filter((l) => ["text", "roots", "patterns", "gharib", "topics"].includes(l.id))],
    [t("group.lexica"), d.layers.filter((l) => l.group === "lexica")],
    [t("group.tafsir"), d.layers.filter((l) => l.group === "tafsir" || l.group === "translation")],
    [t("group.texts"), d.layers.filter((l) => ["hadith-split", "narrators", "book-pages"].includes(l.id))],
  ];
  const r = d.review;
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-semibold">{t("title")}</h1>
        <p className="max-w-[720px] text-[14px] leading-relaxed text-t2">{t("lead", { version: d.version ?? "" })}</p>
      </header>
      <p className="rounded-xl border border-amber/40 bg-amber/5 px-4 py-3 text-[13.5px] leading-relaxed text-t1" role="note">
        {d.signed ? t("signed", { n: n(d.signed) }) : t("notSigned")}
      </p>
      {groups.map(([title, layers]) => (
        <section key={title} aria-label={title} className="flex flex-col">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <ul>{layers.map(row)}</ul>
        </section>
      ))}
      <section aria-labelledby="review-h" className="flex flex-col gap-2">
        <h2 id="review-h" className="text-[17px] font-semibold">{t("group.review")}</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(["proposals_open", "proposals_merged", "corrections_in_force", "board_in_review", "board_approved", "reports_open"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-line bg-card px-3 py-2">
              <dt className="text-[12px] text-t3">{t(`review.${k}`)}</dt>
              <dd className="text-[20px] font-semibold">{n(r[k] ?? 0)}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[12.5px] text-t3">
          {t("reviewLead")} <Link href="/review" className="underline underline-offset-2">{t("reviewLink")}</Link> • <Link href="/sources" className="underline underline-offset-2">{t("sourcesLink")}</Link>
        </p>
      </section>
    </div>
  );
}
