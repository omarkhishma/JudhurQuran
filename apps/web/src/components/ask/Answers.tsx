"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { BarList } from "@/components/charts/BarList";
import { Figure } from "@/components/charts/Figure";
import { SurahColumns } from "@/components/charts/SurahColumns";
import { Link, useRouter } from "@/i18n/navigation";
import { type Answer, type AskPayload, askQuery, type CountAnswer, type MeaningAnswer, type PairAnswer, type Reading, type RootAnswer, type Subject, type SurahAnswer, type SuperlativeAnswer, type ThemeAnswer, type Understood, type VerseRef, type WhereAnswer } from "@/lib/ask";
import { cnt, cnt2, formatNumber, verseRef } from "@/lib/format";
import { encodeSeed } from "@/lib/graph/seedCodec";
import { getJSON } from "@/lib/reader/api";
import type { SurahName } from "./AskScreen";

/** A word or a root as the answer names it, linking to its page. */
function Named({ s }: { s: Subject }) {
  return s.kind === "root" ? (
    <Link href={`/roots/${encodeURIComponent(s.key)}`} className="ar-classical text-[19px] text-root hover:underline" lang="ar">{s.spaced}</Link>
  ) : (
    <Link href={`/word/${s.first}`} className="ar-classical text-[20px] text-word hover:underline" lang="ar">{s.ar}</Link>
  );
}

function Verses({ items }: { items: VerseRef[] }) {
  const locale = useLocale();
  return (
    <ul className="flex flex-col gap-2">
      {items.map((v) => (
        <li key={v.key} className="result-row flex-col items-stretch">
          <Link href={`/quran/${v.surah}/${v.ayah}`} className="flex flex-wrap items-baseline gap-x-2 hover:underline">
            <span className="mono text-[12px] text-t3">{verseRef(v.key, locale)}</span>
            <span className="text-[12.5px] text-t2">{locale === "ar" ? `سورة ${v.name_ar}` : v.name_translit}</span>
          </Link>
          <p className="quran line-clamp-3 text-[19px] leading-[1.9]" lang="ar" dir="rtl">{v.text_qpc}</p>
        </li>
      ))}
    </ul>
  );
}

function Big({ value, children }: { value: number; children: React.ReactNode }) {
  const locale = useLocale();
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="askq-big">{formatNumber(value, locale)}</span>
      <span className="text-[14.5px] leading-relaxed text-t1">{children}</span>
    </div>
  );
}

const scopeOf = (u: Understood, surahs: SurahName[], locale: string) => {
  const s = u.surah ? surahs.find((x) => x.number === u.surah) : null;
  return s ? (locale === "ar" ? s.name_ar : s.name_translit) : null;
};

function CountView({ a, u, surahs }: { a: CountAnswer; u: Understood; surahs: SurahName[] }) {
  const t = useTranslations("ask");
  const locale = useLocale();
  const surah = scopeOf(u, surahs, locale);
  const scope = surah ? t("inSurah", { surah }) : u.place ? t(`in_${u.place}`) : t("inQuran");
  const concordance = a.subject.kind === "root" ? `/concordance?root=${encodeURIComponent(a.subject.key)}` : `/concordance?w=${encodeURIComponent(a.subject.slug)}`;
  return (
    <div className="flex flex-col gap-3">
      <Big value={a.count}>
        <Named s={a.subject} /> {t("times", cnt(a.count, locale))} {scope}، {t("inVerses", cnt(a.verses, locale))}
      </Big>
      {a.root && a.subject.kind === "lemma" && (
        <p className="text-[13px] text-t2">
          {t("rootBeside", { root: a.root.spaced, ...cnt(a.root.count, locale), ...cnt2(a.root.lemmas, locale) })}{" "}
          <Link href={`/roots/${encodeURIComponent(a.root.key)}`} className="text-word underline">{t("openRoot")}</Link>
        </p>
      )}
      {a.entity && (
        <p className="text-[12.5px] text-t2">
          {t("entity", { label: (locale === "ar" ? a.entity.wikidata_label_ar : a.entity.wikidata_label_en) ?? a.entity.wikidata_id })}{" "}
          <a href={`https://www.wikidata.org/wiki/${a.entity.wikidata_id}`} target="_blank" rel="noreferrer" className="text-word underline">Wikidata</a>
        </p>
      )}
      <Links items={[{ href: concordance, label: t("openConcordance") }, ...(a.subject.kind === "lemma" ? [{ href: `/word/${a.subject.first}`, label: t("openWord") }] : [])]} />
      <p className="text-[11.5px] text-t3">{t("counted")}</p>
    </div>
  );
}

function Links({ items }: { items: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((l) => (
        <Link key={l.href} href={l.href} className="btn min-h-[40px]">{l.label}</Link>
      ))}
    </div>
  );
}

function WhereView({ a }: { a: WhereAnswer }) {
  const t = useTranslations("ask");
  const locale = useLocale();
  const router = useRouter();
  const [by, setBy] = useState<"revelation" | "mushaf">("mushaf");
  const name = (s: { name_ar: string; name_translit: string }) => (locale === "ar" ? s.name_ar : s.name_translit);
  const head = (
    <Big value={a.count}>
      <Named s={a.subject} /> {t("times", cnt(a.count, locale))} {t("inSurahs", cnt(a.surah_count, locale))}، {t("placeSplit", { meccan: formatNumber(a.place.meccan, locale), medinan: formatNumber(a.place.medinan, locale) })}
    </Big>
  );
  const concordance = a.subject.kind === "root" ? `/concordance?root=${encodeURIComponent(a.subject.key)}` : `/concordance?w=${encodeURIComponent(a.subject.slug)}`;
  if (a.kind === "distribution") {
    return (
      <div className="flex flex-col gap-3">
        {head}
        <Figure
          id="ask-dist"
          title={t("distTitle")}
          caption={t("distCaption")}
          legend={
            <div className="seg-group" role="group" aria-label={t("order")}>
              {(["mushaf", "revelation"] as const).map((v) => (
                <button key={v} type="button" className={"seg" + (by === v ? " is-on" : "")} aria-pressed={by === v} onClick={() => setBy(v)}>
                  {t(v === "mushaf" ? "orderMushaf" : "orderRevelation")}
                </button>
              ))}
            </div>
          }
          table={
            <table>
              <thead><tr><th>{t("colSurah")}</th><th>{t("colCount")}</th></tr></thead>
              <tbody>{a.surahs.filter((s) => s.count).map((s) => <tr key={s.surah}><td>{`${formatNumber(s.surah, locale)}. ${name(s)}`}</td><td>{formatNumber(s.count, locale)}</td></tr>)}</tbody>
            </table>
          }
        >
          <SurahColumns by={by} label={t("distTitle")} onPick={(n) => router.push(`/quran/${n}`)} data={a.surahs.map((s) => ({ surah: s.surah, name: name(s), place: s.place, order: s.revelation_order, value: s.count }))} />
        </Figure>
        <Links items={[{ href: concordance, label: t("openConcordance") }]} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {head}
      <Figure id="ask-where" title={t("whereTitle")}>
        <BarList items={a.surahs.slice(0, 12).map((s) => ({ key: String(s.surah), label: `${formatNumber(s.surah, locale)}. ${name(s)}`, value: s.count, href: `/quran/${s.surah}` }))} />
      </Figure>
      {a.first && a.first.length > 0 && (
        <>
          <h3 className="text-[13px] font-semibold">{t("firstVerses")}</h3>
          <Verses items={a.first} />
        </>
      )}
      <Links items={[{ href: concordance, label: t("openConcordance") }]} />
    </div>
  );
}

function MeaningView({ a }: { a: MeaningAnswer }) {
  const t = useTranslations("ask");
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14.5px]">{t("meaningLead")} <Named s={a.subject} /></p>
      {a.gharib.length === 0 ? (
        <p className="text-[13px] text-t2">{t("noGharib")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {a.gharib.map((g, i) => (
            <li key={i} className="flex flex-col gap-0.5 border-t border-line pt-2">
              <span className="text-[11.5px] text-t3">
                <bdi lang="ar">{locale === "ar" ? g.title_ar : g.title_en}</bdi> • <span className="mono">{verseRef(g.verse_key, locale)}</span> • <bdi lang="ar">{g.phrase_ar}</bdi>
              </span>
              <span className="ar-classical text-[16.5px] leading-[1.9] text-t1" lang="ar" dir="rtl">{g.meaning_ar}</span>
            </li>
          ))}
        </ul>
      )}
      <Links items={a.word_page ? [{ href: a.word_page, label: t("allLayers") }] : a.root_page ? [{ href: a.root_page, label: t("openRoot") }] : []} />
    </div>
  );
}

function RootView({ a }: { a: RootAnswer }) {
  const t = useTranslations("ask");
  const locale = useLocale();
  const word = a.subject.kind === "lemma" ? a.subject.ar : a.subject.spaced;
  if (!a.root) return <p className="text-[14px]" lang={locale}>{t("noRoot", { word })}</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14.5px]">
        {t("rootLead", { word })}{" "}
        <Link href={`/roots/${encodeURIComponent(a.root.key)}`} className="ar-classical text-[24px] text-root hover:underline" lang="ar">{a.root.spaced}</Link>
      </p>
      <p className="text-[13px] text-t2">{t("rootFigures", { ...cnt(a.root.occurrences, locale), ...cnt2(a.root.lemma_count, locale) })}</p>
      {locale === "ar" && a.root.gist_ar && <p className="ar-classical text-[15.5px] text-t1" lang="ar">{a.root.gist_ar}</p>}
      {locale === "en" && a.root.gloss_en && <p className="text-[13.5px] text-t1">{a.root.gloss_en}</p>}
      {a.family && a.family.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="label-caps">{t("family")}</span>
          <ul className="flex flex-wrap gap-1.5">
            {a.family.map((f) => (
              <li key={f.slug}>
                <Link href={`/search?q=${encodeURIComponent(f.ar)}`} className="chip" lang="ar">
                  <span className="ar-classical text-[16px]">{f.ar}</span> <span className="mono text-[11px] text-t3">{formatNumber(f.occurrences, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PairView({ a, reading, q }: { a: PairAnswer; reading: Reading | null; q: string }) {
  const t = useTranslations("ask");
  const locale = useLocale();
  const [pages, setPages] = useState(1);
  const more = useQuery({
    queryKey: ["ask-quran-more", q, reading, pages],
    queryFn: () => getJSON<AskPayload>(`/ask?${askQuery(q, reading, { limit: String(20 * pages) })}`),
    enabled: a.kind === "together" && pages > 1,
    staleTime: 60_000,
  });
  const verses = pages > 1 && more.data && "verses" in more.data.answer ? (more.data.answer as PairAnswer).verses : a.verses;
  if (a.kind === "together") {
    return (
      <div className="flex flex-col gap-3">
        <Big value={a.shared_verses}>
          {t("togetherLead", { ...cnt(a.shared_verses, locale) })} <Named s={a.a} /> {t("and")} <Named s={a.b} />
        </Big>
        <Verses items={verses} />
        {verses.length < a.shared_verses && (
          <button type="button" className="btn self-start" onClick={() => setPages(pages + 1)} disabled={more.isFetching}>
            {t("more", { shown: formatNumber(verses.length, locale), total: formatNumber(a.shared_verses, locale) })}
          </button>
        )}
      </div>
    );
  }
  const c = a.counts!;
  const rows: [string, "n" | "v" | "meccan" | "medinan"][] = [["colTimes", "n"], ["colVerses", "v"], ["placeMeccan", "meccan"], ["placeMedinan", "medinan"]];
  return (
    <div className="flex flex-col gap-3">
      <table className="askq-compare">
        <thead>
          <tr>
            <th />
            <th><Named s={a.a} /></th>
            <th><Named s={a.b} /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, k]) => (
            <tr key={k}>
              <th scope="row">{t(label)}</th>
              <td className="mono">{formatNumber(Number(c.a[k]), locale)}</td>
              <td className="mono">{formatNumber(Number(c.b[k]), locale)}</td>
            </tr>
          ))}
          {(c.a.root || c.b.root) && (
            <tr>
              <th scope="row">{t("colRootTimes")}</th>
              {[c.a.root, c.b.root].map((r, i) => (
                <td key={i}>
                  {r ? (
                    <Link href={`/roots/${encodeURIComponent(r.key)}`} className="hover:underline">
                      <span className="ar-classical text-root" lang="ar">{r.spaced}</span> <span className="mono">{formatNumber(r.n, locale)}</span>
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
      <p className="text-[13.5px]">{t("sharedVerses", cnt(a.shared_verses, locale))}{a.same_root ? ` ${t("sameRoot")}` : ""}</p>
      {a.relations && a.relations.length > 0 && (
        <p className="text-[13px] text-t2">{t("relationsSet", { relations: a.relations.map((r) => t(`rel_${r.relation}`)).join("، ") })}</p>
      )}
      {a.verses.length > 0 && <Verses items={a.verses} />}
      <p className="text-[11.5px] text-t3">{t("compareNote")}</p>
    </div>
  );
}

export function ThemeView({ a }: { a: ThemeAnswer }) {
  const t = useTranslations("ask");
  const locale = useLocale();
  const items = a.semantic.items ?? [];
  return (
    <div className="flex flex-col gap-3">
      {a.semantic.status === "ok" && items.length > 0 ? (
        <>
          <p className="text-[12px] leading-relaxed text-t3">{t("themeNote")}</p>
          <ul className="flex flex-col gap-2">
            {items.slice(0, 10).map((h) => (
              <li key={h.verse.key} className="result-row flex-col items-stretch">
                <Link href={`/quran/${h.verse.surah}/${h.verse.ayah}`} className="flex flex-wrap items-baseline gap-x-2 hover:underline">
                  <span className="mono text-[12px] text-t3">{verseRef(h.verse.key, locale)}</span>
                  <span className="text-[12.5px] text-t2">{locale === "ar" ? `سورة ${h.verse.name_ar}` : h.verse.name_translit}</span>
                </Link>
                <p className="quran line-clamp-3 text-[19px] leading-[1.9]" lang="ar" dir="rtl">{h.verse.text_qpc}</p>
              </li>
            ))}
          </ul>
          <Links items={[{ href: `/search?q=${encodeURIComponent(a.text)}`, label: t("moreInSearch") }]} />
        </>
      ) : (
        <p className="text-[13px] text-t2">{t(a.semantic.status === "unavailable" ? "themeUnavailable" : "themeNone")}</p>
      )}
      {a.topics.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="label-caps">{t("topicsLead")}</span>
          <ul className="flex flex-wrap gap-1.5">
            {a.topics.map((x) => (
              <li key={x.id}>
                <Link href={`/graph/seed?s=${encodeSeed({ seed: "topic", topic: x.id })}`} className="chip" dir="auto">
                  {x.name} <span className="mono text-[11px] text-t3">{formatNumber(x.verse_count, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SurahView({ a }: { a: SurahAnswer }) {
  const t = useTranslations("ask");
  const locale = useLocale();
  const s = a.surah;
  const tiles: [string, number | string][] = [
    ["colVerses", s.verses],
    ["colWords", s.words],
    ["colRoots", s.roots],
    ["colLemmas", s.lemmas],
    ["colHapax", s.hapax],
    ["colOrder", s.revelation_order],
  ];
  const lead = a.focus === "verses" ? s.verses : a.focus === "words" ? s.words : a.focus === "roots" ? s.roots : null;
  return (
    <div className="flex flex-col gap-3">
      {lead !== null && <Big value={lead}>{t(`surahLead_${a.focus}`, { surah: locale === "ar" ? s.name_ar : s.name_translit })}</Big>}
      <p className="text-[14px]">
        <Link href={`/quran/${s.number}`} className="ar-classical text-[19px] hover:underline" lang="ar">{`سورة ${s.name_ar}`}</Link> • {t(`place_${s.place}`)}
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([k, v]) => (
          <li key={k} className="dash-tile">
            <span className="text-[11.5px] text-t3">{t(k)}</span>
            <span className="text-[20px] font-semibold">{typeof v === "number" ? formatNumber(v, locale) : v}</span>
          </li>
        ))}
      </ul>
      {s.unique_roots.length > 0 && (
        <p className="text-[13px] text-t2">
          {t("uniqueRoots")} <span lang="ar">{s.unique_roots.slice(0, 12).map((r) => r.spaced).join("، ")}</span>
        </p>
      )}
      <Links items={[{ href: `/stats/surah/${s.number}`, label: t("surahStats") }]} />
    </div>
  );
}

function SuperlativeView({ a }: { a: SuperlativeAnswer }) {
  const t = useTranslations("ask");
  const locale = useLocale();
  const f = a.focus;
  const surah = f.endsWith("surah");
  const verse = f.endsWith("verse");
  const root = f.includes("root");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14.5px] font-medium">{t(`focus_${f}`)}</p>
      <ol className="flex flex-col gap-2">
        {a.items.map((x, i) => (
          <li key={i} className="result-row flex-col items-stretch">
            {surah ? (
              <Link href={`/quran/${x.number}`} className="flex flex-wrap items-baseline gap-x-2 hover:underline">
                <span className="ar-classical text-[18px]" lang="ar">{`سورة ${x.name_ar}`}</span>
                <span className="text-[12.5px] text-t2">{t("surahSize", { ...cnt(Number(x.verse_count), locale), ...cnt2(Number(x.word_count), locale) })}</span>
              </Link>
            ) : verse ? (
              <>
                <Link href={`/quran/${x.surah}/${x.ayah}`} className="flex flex-wrap items-baseline gap-x-2 hover:underline">
                  <span className="mono text-[12px] text-t3">{verseRef(String(x.key), locale)}</span>
                  <span className="text-[12.5px] text-t2">{t("verseWords", cnt(Number(x.words), locale))}</span>
                </Link>
                <p className="quran line-clamp-3 text-[19px] leading-[1.9]" lang="ar" dir="rtl">{String(x.text_qpc)}</p>
              </>
            ) : root ? (
              <Link href={`/roots/${encodeURIComponent(String(x.key))}`} className="flex flex-wrap items-baseline gap-x-2 hover:underline">
                <span className="ar-classical text-[19px] text-root" lang="ar">{String(x.spaced)}</span>
                <span className="text-[12.5px] text-t2">{t("times", cnt(Number(x.occurrences), locale))}</span>
              </Link>
            ) : (
              <Link href={`/search?q=${encodeURIComponent(String(x.ar))}`} className="flex flex-wrap items-baseline gap-x-2 hover:underline">
                <span className="ar-classical text-[19px] text-word" lang="ar">{String(x.ar)}</span>
                <span className="text-[12.5px] text-t2">{t("times", cnt(Number(x.occurrences), locale))}</span>
              </Link>
            )}
          </li>
        ))}
      </ol>
      <p className="text-[11.5px] text-t3">{t("measured", { measure: t(`measure_${f.includes("verse") ? "words" : f.includes("surah") ? "verses" : f.includes("noun") || f.includes("verb") ? "words" : "content"}`) })}</p>
    </div>
  );
}

export function AnswerView({ a, u, surahs, reading, q }: { a: Answer; u: Understood; surahs: SurahName[]; onPage: () => void; reading: Reading | null; q: string }) {
  const t = useTranslations("ask");
  switch (a.kind) {
    case "count":
      return <CountView a={a} u={u} surahs={surahs} />;
    case "where":
    case "distribution":
      return <WhereView a={a} />;
    case "meaning":
      return <MeaningView a={a} />;
    case "root":
      return <RootView a={a} />;
    case "compare":
    case "together":
      return <PairView a={a} reading={reading} q={q} />;
    case "theme":
      return <ThemeView a={a} />;
    case "surah":
      return <SurahView a={a} />;
    case "superlative":
      return <SuperlativeView a={a} />;
    default:
      return (
        <p className="text-[14px] text-t1" role="status">
          {t(`unresolved_${a.missing}`, { text: (a.missing === "b" ? u.b?.text : u.a?.text) ?? "" })}
        </p>
      );
  }
}
