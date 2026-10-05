import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd, breadcrumbs } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { cnt, formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";
import type { RootDetail } from "@/lib/types";

export const revalidate = 86400;

async function load(raw: string) {
  const [r, meta] = await Promise.all([
    api<RootDetail>(`/roots/${encodeURIComponent(decodeURIComponent(raw))}`),
    api<{ dataset: { version: string } }>("/meta"),
  ]);
  return { r, version: meta.dataset.version };
}

// Rendered on first request and then cached until the next release (ISR); none are built ahead.
export function generateStaticParams() {
  return [];
}

type T = Awaited<ReturnType<typeof getTranslations<"roots">>>;

/** The root's count said in one sentence, as the page and its answer for search engines say it. */
function sentence(t: T, r: RootDetail, locale: string) {
  return t("countSentence", {
    root: r.spaced,
    words: t("countTimes", cnt(r.occurrences, locale)),
    verses: t("countVerses", cnt(r.verse_count, locale)),
    surahs: t("countSurahs", cnt(r.surah_count, locale)),
    lemmas: t("countLemmas", cnt(r.lemma_count, locale)),
  });
}

export async function generateMetadata({ params }: PageProps<"/[locale]/roots/[root]/count">): Promise<Metadata> {
  const { locale, root } = await params;
  const { r, version } = await load(root);
  const t = await getTranslations({ locale, namespace: "roots" });
  return {
    title: t("countTitle", { root: r.spaced }),
    description: `${sentence(t, r, locale)} ${t("countVersion", { version })}`,
    alternates: localized(locale, `/roots/${encodeURIComponent(r.key)}/count`),
  };
}

/**
 * «كم مرة ذكر … في القرآن؟» (B8a, PLAN §8): a root's count answered — what was counted, in which release — and the
 * same root counted the other ways the web counts it, each number computed from our data: by verses, by kind of word,
 * by its commonest word alone, and with the words other sources file under another root. No other site's number is
 * named: the page says what each way of counting gives, so a reader can tell which one they met.
 */
export default async function RootCountPage({ params }: PageProps<"/[locale]/roots/[root]/count">) {
  const { locale, root } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("roots");
  const { r, version } = await load(root);
  const ar = locale === "ar";
  const n = (x: number) => formatNumber(x, locale);
  const of = (pos: string[]) => r.lemmas.filter((l) => pos.includes(l.pos)).reduce((s, l) => s + l.occurrences, 0);
  const top = [...r.lemmas].sort((a, b) => b.occurrences - a.occurrences)[0];
  const ways: [string, number][] = [
    [t("countWayWords"), r.occurrences],
    [t("countWayVerses"), r.verse_count],
    ...([
      ["countWayVerbs", ["V"]],
      ["countWayNouns", ["N", "IMPN"]],
      ["countWayAdjectives", ["ADJ"]],
      ["countWayProper", ["PN"]],
    ] as const)
      .map(([k, pos]): [string, number] => [t(k), of([...pos])])
      .filter(([, x]) => x > 0 && x < r.occurrences),
    ...(top && r.lemmas.length > 1 ? [[t("countWayTop", { lemma: top.ar }), top.occurrences] as [string, number]] : []),
    ...(r.also_attributed.length ? [[t("countWayWithOthers", cnt(r.also_attributed.length, locale)), r.occurrences + r.also_attributed.length] as [string, number]] : []),
    ...(r.variants.length ? [[t("countWayWithoutVariants", cnt(r.variants.length, locale)), r.occurrences - r.variants.length] as [string, number]] : []),
  ];
  const answer = `${sentence(t, r, locale)} ${t("countVersion", { version })}`;
  const href = `/roots/${encodeURIComponent(r.key)}`;
  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-6 px-4 py-10">
      <JsonLd data={breadcrumbs(locale, [[ar ? "الرئيسية" : "Home", "/"], [t("indexTitle"), "/roots"], [r.spaced, href], [t("countTitle", { root: r.spaced }), `${href}/count`]])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [{ "@type": "Question", name: t("countTitle", { root: r.spaced }), acceptedAnswer: { "@type": "Answer", text: answer } }],
        }}
      />
      <nav className="flex flex-wrap gap-x-2 text-[13px] text-t3" aria-label="breadcrumb">
        <Link href="/roots" className="hover:text-t1">{t("indexTitle")}</Link>
        <span aria-hidden="true">›</span>
        <Link href={href} className="ar-classical hover:text-t1" lang="ar">{r.spaced}</Link>
      </nav>
      <header className="flex flex-col gap-3">
        <h1 className="text-[26px] font-semibold leading-snug">{t("countTitle", { root: r.spaced })}</h1>
        <p className="card flex flex-col gap-1 p-5">
          <span className="text-[34px] font-semibold text-t1">{t("countTimes", cnt(r.occurrences, locale))}</span>
          <span className="text-[15px] leading-relaxed text-t1">{sentence(t, r, locale)}</span>
          <span className="text-[13px] text-t2">
            {t("countVersion", { version })} <Link href="/data" className="underline underline-offset-2">{t("countAboutData")}</Link>
          </span>
        </p>
      </header>

      <section aria-labelledby="count-what" className="flex flex-col gap-2">
        <h2 id="count-what" className="text-[18px] font-semibold">{t("countWhatTitle")}</h2>
        <p className="max-w-[75ch] text-[14.5px] leading-relaxed text-t2">{t("countWhatBody")}</p>
      </section>

      <section aria-labelledby="count-why" className="flex flex-col gap-3">
        <h2 id="count-why" className="text-[18px] font-semibold">{t("countWhyTitle")}</h2>
        <p className="max-w-[75ch] text-[14.5px] leading-relaxed text-t2">{t("countWhyBody")}</p>
        <table className="w-full max-w-[640px] text-[14px]">
          <caption className="sr-only">{t("countWaysCaption", { root: r.spaced })}</caption>
          <tbody>
            {ways.map(([label, x]) => (
              <tr key={label} className="border-b border-line">
                <th scope="row" className="py-2 text-start font-normal text-t2">{label}</th>
                <td className="py-2 text-end text-[16px] font-semibold tabular-nums text-t1">{n(x)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="count-lemmas" className="flex flex-col gap-2">
        <h2 id="count-lemmas" className="text-[18px] font-semibold">{t("countLemmasTitle")}</h2>
        <ul className="flex flex-col">
          {r.lemmas.map((l) => (
            <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-line py-2">
              <Link href={`/read?w=${encodeURIComponent(l.slug ?? l.key)}`} className="ar-classical text-[20px] hover:underline" lang="ar">
                {l.ar}
              </Link>
              <span className="text-[13px] text-t3" dir="auto">{l.gloss_en}</span>
              <span className="ms-auto text-[13.5px] text-t2">
                {t("countTimes", cnt(l.occurrences, locale))} • {t("countVerses", cnt(l.verse_count, locale))}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-[13.5px]">
        <Link href={href} className="underline underline-offset-2">{t("countBack", { root: r.spaced })}</Link>
      </p>
    </div>
  );
}
