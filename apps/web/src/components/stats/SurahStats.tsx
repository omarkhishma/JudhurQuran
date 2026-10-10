"use client";

import { useLocale, useTranslations } from "next-intl";
import { BarList } from "@/components/charts/BarList";
import { Figure, RampKey } from "@/components/charts/Figure";
import { PageGrid } from "@/components/charts/Heatmap";
import { SurahColumns } from "@/components/charts/SurahColumns";
import { Link, useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import type { Distribution, SurahDetail } from "@/lib/stats";

/**
 * One sūra in numbers (P16): its size and vocabulary beside the Quran's; its most used roots (per thousand of its
 * words, and how many the root has in the whole Quran); the roots no other sūra has; its words found once in the
 * whole Quran; the sūras whose vocabulary is nearest; and where its most used root runs through the sūras and the
 * mushaf's pages.
 */
export function SurahStats({ d, dist }: { d: SurahDetail; dist: Distribution | null }) {
  const t = useTranslations("stats");
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const n = (x: number) => formatNumber(x, locale);
  const name = ar ? d.name_ar : d.name_translit;
  const tile = (label: string, value: string) => (
    <div className="dash-tile">
      <span className="text-[12px] text-t2">{label}</span>
      <span className="text-[22px] font-semibold leading-tight text-t1">{value}</span>
    </div>
  );
  return (
    <>
      <header className="flex flex-col gap-2">
        <nav className="text-[12px] text-t3">
          <Link href="/stats" className="hover:underline">{t("title")}</Link>
        </nav>
        <h1 className="text-[24px] font-semibold">{t("surahTitle", { name })}</h1>
        <p className="text-[13px] text-t2">
          {t(d.place)} • {t("revelationOrderN", { n: n(d.revelation_order) })} •{" "}
          <Link href={`/quran/${d.surah}`} className="text-word underline underline-offset-2">{t("readSurah")}</Link>
        </p>
      </header>
      <section className="dash-kpis" aria-label={t("overview")}>
        {tile(t("metric_verses"), n(d.verses))}
        {tile(t("metric_words"), n(d.words))}
        {tile(t("metric_words_per_verse"), n(d.words_per_verse))}
        {tile(t("metric_roots"), n(d.roots))}
        {tile(t("metric_unique_roots"), n(d.unique_roots))}
        {tile(t("metric_hapax"), n(d.hapax))}
      </section>
      <div className="stats-grid is-two">
        <Figure id="sroots" title={t("surahTopRoots")} caption={t("surahTopRootsCaption")}>
          <BarList
            format={(v) => n(v)}
            items={d.top_roots.map((r) => ({
              key: r.key,
              value: r.count,
              href: `/roots/${encodeURIComponent(r.key)}`,
              label: (
                <span>
                  <span className="ar-classical text-[15px]" lang="ar">{r.spaced}</span>
                  <span className="text-[11px] text-t3">{` • ${t("perThousand", { n: n(r.per_1000) })} • ${t("inQuran", { n: n(r.quran) })}`}</span>
                </span>
              ),
            }))}
          />
        </Figure>
        <div className="flex flex-col gap-4">
          <Figure id="sown" title={t("surahOwnRoots")} caption={t("surahOwnRootsCaption")}>
            {d.unique_roots.length === 0 ? (
              <p className="text-[12.5px] text-t3">{t("none")}</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {d.unique_roots.map((r) => (
                  <li key={r.key}>
                    <Link href={`/roots/${encodeURIComponent(r.key)}`} prefetch={false} className="chip">
                      <span lang="ar">{r.spaced}</span> <span className="mono text-[10.5px] text-t3">{n(r.count)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Figure>
          <Figure id="shapax" title={t("surahHapax")} caption={t("surahHapaxCaption")}>
            {d.hapax_lemmas.length === 0 ? (
              <p className="text-[12.5px] text-t3">{t("none")}</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {d.hapax_lemmas.map((l) => (
                  <li key={l.slug}>
                    <Link href={`/quran/${d.surah}?w=${encodeURIComponent(l.slug)}`} prefetch={false} className="chip ar-classical text-[15px]" lang="ar">
                      {l.ar}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Figure>
          <Figure id="snear" title={t("surahNeighbours")} caption={t("surahNeighboursCaption")}>
            <ul className="flex flex-col gap-1">
              {d.neighbours.map((s) => (
                <li key={s.surah} className="flex items-baseline gap-2 text-[13.5px]">
                  <Link href={`/stats/surah/${s.surah}`} prefetch={false} className="hover:underline">{`${n(s.surah)}. ${ar ? s.name_ar : s.name_translit}`}</Link>
                  <span className="mono text-[11px] text-t3">{n(s.similarity)}</span>
                </li>
              ))}
            </ul>
          </Figure>
        </div>
      </div>
      {dist && dist.root && (
        <div className="stats-grid is-two">
          <Figure id="sdist" title={t("rootThrough", { root: dist.root.spaced })} caption={t("rootThroughCaption", { total: n(dist.total), verses: n(dist.verses) })}>
            <SurahColumns label={t("rootThrough", { root: dist.root.spaced })} by="mushaf" data={dist.surahs.map((s) => ({ surah: s.surah, name: ar ? s.name_ar : s.name_translit, place: s.place, order: s.revelation_order, value: s.per_1000 }))} onPick={(s) => router.push(`/stats/surah/${s}`)} />
          </Figure>
          <Figure id="spages" title={t("rootPages", { root: dist.root.spaced })} caption={t("rootPagesCaption")} legend={<RampKey hue="var(--chart-root)" low={t("none")} high={t("most")} />}>
            <PageGrid pages={dist.pages} label={t("rootPages", { root: dist.root.spaced })} onPage={(p) => router.push(`/mushaf/${p}`)} />
          </Figure>
        </div>
      )}
    </>
  );
}
