import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContextStrip, type SurahName } from "@/components/home/ContextStrip";
import { HubSearch } from "@/components/home/HubSearch";
import { LocalFirstPrompt } from "@/components/home/LocalFirstPrompt";
import { RootOfTheDay } from "@/components/home/RootOfTheDay";
import { JsonLd, website } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { meccaToday, type WordOfTheDay } from "@/lib/daily";
import { DESTINATIONS } from "@/lib/destinations";
import { formatNumber } from "@/lib/format";
import { localized } from "@/lib/seo";
import type { Meta, Surah } from "@/lib/types";

// the root of the day changes at Mecca's midnight; the page is rebuilt often enough to follow it, and the
// browser asks for the new day itself if a cached page is older than that (RootOfTheDay)
export const revalidate = 600;

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localized(locale, "/") };
}

/**
 * The hub (06 §6.1, inventory HUB-01…50 with the Quran notes HUB-Q01…Q08): the root of the day as the
 * masthead's glyph, the name جَذْر with its meaning in Ibn Fāris's words, the premise in one sentence, the
 * search as the primary action, where the reader left off, three doors with counts from the data, every
 * surface of the platform with what it is for, and the local-first note.
 */
export default async function HubPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hub");
  const [meta, surahs, lexica, word] = await Promise.all([
    api<Meta>("/meta"),
    api<{ data: Surah[] }>("/surahs"),
    api<{ data: unknown[] }>("/lexicon/works"),
    api<WordOfTheDay>(`/word-of-the-day?date=${meccaToday()}`).catch(() => null),
  ]);
  const c = meta.dataset.counts;
  const n = (x: number) => formatNumber(x, locale);
  const names: SurahName[] = surahs.data.map((s) => [s.number, s.name_ar, s.name_translit]);

  return (
    <div className="hub">
      <JsonLd data={website(locale)} />
      <ContextStrip surahs={names} />
      <section className="hub-hero" aria-labelledby="hub-title">
        <RootOfTheDay initial={word} />
        <h1 id="hub-title" className="hub-title">{t("title")}</h1>
        <figure className="hub-name">
          <figcaption className="label-caps">{t("nameLabel")}</figcaption>
          <p>
            <span className="ar-classical text-[22px] text-root" lang="ar">جَذْر</span>
            {locale !== "ar" && <span className="text-[13px] text-t2"> {t("nameGloss")}</span>}
            <span aria-hidden="true"> — </span>
            <span className="ar-classical text-[18px]" lang="ar" dir="rtl">«{t("nameQuote")}»</span>
          </p>
          <cite className="text-[12px] not-italic text-t3">{t("nameCite")}</cite>
        </figure>
        <p className="hub-lead">{t("lead")}</p>
        <HubSearch />
        <nav aria-label={t("doors")} className="hub-doors">
          <Link href="/read" className="hub-door">
            <span className="dot" style={{ background: "var(--c-sentence)" }} aria-hidden="true" />
            <span className="hub-door-title">{t("doorRead")}</span>
            <span className="hub-door-sub">{t("doorReadSub", { surahs: n(c.surahs), verses: n(c.verses) })}</span>
          </Link>
          <Link href="/read?mode=lookup" className="hub-door">
            <span className="dot" style={{ background: "var(--c-root)" }} aria-hidden="true" />
            <span className="hub-door-title">{t("doorLookup")}</span>
            <span className="hub-door-sub">{t("doorLookupSub", { roots: n(c.roots), lemmas: n(c.lemmas), lexica: lexica.data.length, lx: n(lexica.data.length) })}</span>
          </Link>
          <Link href="/graph" className="hub-door">
            <span className="dot" style={{ background: "var(--c-form)" }} aria-hidden="true" />
            <span className="hub-door-title">{t("doorMap")}</span>
            <span className="hub-door-sub">{t("doorMapSub")}</span>
          </Link>
        </nav>
      </section>

      <section className="hub-section" aria-labelledby="hub-all">
        <h2 id="hub-all" className="label-caps">{t("everything")}</h2>
        <ul className="hub-all">
          {DESTINATIONS.map((d) => {
            const body = (
              <>
                <span className="hub-tile-title">{t(`dest.${d.key}.title`)}</span>
                <span className="hub-tile-purpose">{t(`dest.${d.key}.purpose`)}</span>
                {d.phase && <span className="hub-tile-phase">{t("building")}</span>}
              </>
            );
            return (
              <li key={d.key}>
                {d.href ? (
                  // twenty destinations: prefetching them all would render twenty pages per visit
                  <Link href={d.href} prefetch={false} className="hub-tile" data-building={d.phase ? "" : undefined}>
                    {body}
                  </Link>
                ) : (
                  <div className="hub-tile" data-building="" aria-disabled="true">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="hub-section">
        <LocalFirstPrompt />
      </div>
    </div>
  );
}
