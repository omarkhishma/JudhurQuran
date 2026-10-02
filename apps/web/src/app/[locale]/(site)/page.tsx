import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import type { Meta, Verse } from "@/lib/types";
import { HomeSearch } from "@/components/home/HomeSearch";
import { ContinueReading } from "@/components/home/ContinueReading";
import { formatNumber } from "@/lib/format";

const FEATURED_ROOTS = ["رحم", "علم", "كتب", "هدي", "قرأ", "صبر", "نور", "سلم"];

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const [meta, first] = await Promise.all([
    api<Meta>("/meta"),
    api<Verse & { words: Verse["words"] }>("/verses/96:1"),
  ]);
  const c = meta.dataset.counts;
  const firstWord = first.tokens[0];

  return (
    <div className="mx-auto max-w-[1100px] px-4">
      <section className="flex flex-col items-center pt-14 pb-10 text-center md:pt-20" aria-labelledby="home-title">
        <figure className="mb-8">
          <blockquote className="quran text-[34px] text-t1 md:text-[44px]" dir="rtl" lang="ar">
            <Link
              href={`/word/96:1:1`}
              className="rounded-md bg-root-wash px-1 text-root decoration-root/40 underline-offset-[10px] hover:underline"
            >
              {firstWord.text}
            </Link>{" "}
            {first.tokens.slice(1).map((tk) => tk.text).join(" ")}
          </blockquote>
          <figcaption className="mt-1 text-[12.5px] text-t3">
            <Link href="/quran/96/1" className="hover:text-t1">
              {locale === "ar" ? "العلق: ١ — أول ما نزل من القرآن" : "al-ʿAlaq 96:1 — the first revealed verse"}
            </Link>
          </figcaption>
        </figure>
        <h1 id="home-title" className="max-w-[22ch] text-[30px] font-semibold leading-tight text-t1 md:text-[40px]">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-[62ch] text-[15.5px] leading-relaxed text-t2">{t("lead")}</p>
        <div className="mt-7 w-full max-w-[560px]">
          <HomeSearch />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/quran" className="btn btn-primary min-h-[40px] px-5 text-[14px]">
            {t("startReading")}
          </Link>
          <Link href="/roots" className="btn min-h-[40px] px-5 text-[14px]">
            {t("exploreRoots")}
          </Link>
        </div>
        <ContinueReading />
      </section>

      <section aria-labelledby="how-title" className="py-8">
        <h2 id="how-title" className="label-caps mb-4">{t("howTitle")}</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["how1", "var(--c-word)"],
              ["how2", "var(--c-root)"],
              ["how3", "var(--c-form)"],
              ["how4", "var(--c-sentence)"],
            ] as const
          ).map(([k, color], i) => (
            <li key={k} className="card p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="dot" style={{ background: color }} />
                <span className="mono text-[11px] text-t3">{formatNumber(i + 1, locale)}</span>
                <h3 className="text-[15px] font-semibold text-t1">{t(`${k}Title`)}</h3>
              </div>
              <p className="text-[13.5px] leading-relaxed text-t2">{t(`${k}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="roots-title" className="py-8">
        <h2 id="roots-title" className="label-caps mb-4">{t("featuredTitle")}</h2>
        <ul className="flex flex-wrap gap-2">
          {FEATURED_ROOTS.map((r) => (
            <li key={r}>
              <Link
                href={`/roots/${encodeURIComponent(r)}`}
                className="ar-classical inline-flex min-h-[44px] items-center rounded-xl border border-line bg-card px-4 text-[22px] text-root shadow-rest transition-colors hover:border-root"
                lang="ar"
              >
                {r.split("").join(" ")}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stats-title" className="py-8">
        <h2 id="stats-title" className="label-caps mb-4">{t("statsTitle")}</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              ["statSurahs", c.surahs],
              ["statVerses", c.verses],
              ["statWords", c.words],
              ["statRoots", c.roots],
              ["statLemmas", c.lemmas],
            ] as const
          ).map(([k, n]) => (
            <div key={k} className="card flex flex-col gap-1 p-4">
              <dd className="mono text-[24px] font-medium text-t1">{formatNumber(n, locale)}</dd>
              <dt className="text-[13px] text-t2">{t(k)}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="trust-title" className="py-8">
        <div className="card p-5 md:p-6">
          <h2 id="trust-title" className="mb-2 text-[16px] font-semibold">{t("trustTitle")}</h2>
          <p className="max-w-[80ch] text-[14px] leading-relaxed text-t2">{t("trustBody")}</p>
          <Link href="/sources" className="mt-3 inline-block text-[13.5px] text-word hover:underline">
            {t("trustLink")}
          </Link>
        </div>
      </section>
    </div>
  );
}
