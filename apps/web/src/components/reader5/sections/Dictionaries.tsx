"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Term } from "@/components/terms/Term";
import { Segmented } from "@/components/ui/Segmented";
import { cnt, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { useMarks } from "@/lib/reader/marks";
import { usePrefs, useReader } from "@/lib/reader/store";
import type { DictEntry, DictWork, WordPayload } from "@/lib/reader/types";
import { DICT_KIND } from "@/lib/lexica";
import { Link } from "@/i18n/navigation";
import { dictHrefOfQuranRoot } from "@/lib/dictionary";

export { DICT_KIND } from "@/lib/lexica";
const KINDS = ["all", "earliest", "general", "root", "interpretive", "english"] as const;

export function deathLabel(d: { death_hijri: number | null; death_ce: number | null }, locale: string, t: ReturnType<typeof useTranslations>): string {
  if (locale === "ar") {
    const h = d.death_hijri ? `${formatNumber(d.death_hijri, locale)}هـ` : "";
    const c = d.death_ce ? `${formatNumber(d.death_ce, locale)}م` : "";
    return h || c ? t("died", { date: [h, c].filter(Boolean).join(" / ") }) : "";
  }
  return d.death_ce ? `d. ${d.death_ce}${d.death_hijri ? ` (${d.death_hijri} AH)` : ""}` : "";
}

/**
 * Old dictionaries (P2.5): list mode with provenance on every article; side by side across up to three
 * dictionaries. The apparatus view needs sense-level alignment between dictionaries, which the editorial
 * workbench builds (P3.4a) — until then it explains that rather than inventing agreement (RDR-253, RDR-560).
 */
export function DictionariesSection({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const mode = usePrefs((s) => s.lexMode);
  const dictOff = usePrefs((s) => s.dictOff);
  const set = usePrefs((s) => s.set);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const works = w.dict_articles.filter((d) => !dictOff[d.id]);
  if (!w.root) return <p className="text-[13px] text-t3">{t("noRootDicts")}</p>;
  if (works.length === 0) return <p className="text-[13px] text-t3">{w.dict_articles.length ? t("allDictsHidden") : t("noArticles")}</p>;
  const counts = Object.fromEntries(KINDS.map((k) => [k, k === "all" ? works.length : works.filter((d) => DICT_KIND[d.id]?.kind === k).length]));
  const listed = kind === "all" ? works : works.filter((d) => DICT_KIND[d.id]?.kind === kind);
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label={t("secDictionaries")}
        value={mode}
        onChange={(v) => set({ lexMode: v })}
        options={[
          { value: "list", label: t("lexList") },
          { value: "compare", label: t("lexCompare") },
          { value: "apparatus", label: t("lexApparatus") },
        ]}
      />
      {mode === "list" && (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("lexFilter")}>
            {KINDS.map((k) => (
              <button key={k} type="button" className={"chip" + (kind === k ? " is-on" : "")} aria-pressed={kind === k} style={{ opacity: counts[k] ? 1 : 0.45 }} onClick={() => setKind(k)}>
                {t(`kind_${k}`)} <span className="mono text-[10.5px] text-t3">{formatNumber(counts[k], locale)}</span>
              </button>
            ))}
          </div>
          <p className="flex flex-wrap justify-between gap-x-3 text-[11.5px] text-t3">
            <span>{t.rich("byDeathDate", { term: (c) => <Term id="lexicon">{c}</Term> })}</span>
            {/* the root's page in the dictionary, every lexicon's article in full (P11.1) */}
            <Link href={dictHrefOfQuranRoot(w.root.key)} className="underline underline-offset-2">{t("openInDictionary")}</Link>
          </p>
          {listed.length === 0 && <p className="text-[12.5px] text-t3">{t("noArticlesOfKind")}</p>}
          {listed.map((d) => (
            <Article key={d.id} d={d} w={w} />
          ))}
        </>
      )}
      {mode === "compare" && <Compare works={works} />}
      {mode === "apparatus" && (
        <p className="rounded-lg border border-dashed border-line-2 px-3 py-2 text-[12.5px] leading-relaxed text-t3">{t("apparatusPending")}</p>
      )}
    </div>
  );
}

function Article({ d, w }: { d: DictWork; w: WordPayload }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const showToast = useReader((s) => s.showToast);
  const setCite = useReader((s) => s.setCite);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const k = DICT_KIND[d.id];
  return (
    <section className="dict-article" data-dict={d.id} aria-label={locale === "ar" ? d.title_ar : d.title_en}>
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="ar-classical text-[19px] text-t1" lang="ar">{d.title_ar}</span>
        {locale !== "ar" && <span className="text-[13px] font-medium">{d.title_en}</span>}
        {k && <span className="tag-pill">{k.tag === "gharib" ? <Term id="gharib">{t(`tag_${k.tag}`)}</Term> : t(`tag_${k.tag}`)}</span>}
        <span className="flex-1" />
        <span className="text-[11.5px] text-t3">{(locale === "ar" ? d.author_ar : d.author_en) + " • " + deathLabel(d, locale, t)}</span>
        <button
          type="button"
          className="text-[11.5px] text-t3 hover:text-t1"
          onClick={() =>
            setCite({
              kind: "article",
              slug: w.slug,
              label: d.title_ar,
              dict: { title_ar: d.title_ar, title_en: d.title_en, author_ar: d.author_ar, author_en: d.author_en },
              root: { spaced: w.root!.ar_spaced, translit: w.root!.translit },
              page: d.entries[0]?.page_ref ?? null,
            })
          }
        >
          {t("cite")}
        </button>
      </header>
      {d.entries.map((e) => (
        <ArticleEntry key={e.id} e={e} lang={d.lang} expanded={!!open[e.id]} onToggle={() => setOpen((o) => ({ ...o, [e.id]: !o[e.id] }))} onCopied={() => showToast(t("entryCopied", { dict: locale === "ar" ? d.title_ar : d.title_en }))} />
      ))}
      <p className="text-[11px] leading-relaxed text-t3">
        {locale === "ar" ? d.attribution_ar : d.attribution_en}
        {!d.redistributable && <> • {t("displayOnly")}</>}
      </p>
    </section>
  );
}

function ArticleEntry({ e, lang, expanded, onToggle, onCopied }: { e: DictEntry; lang: string; expanded: boolean; onToggle: () => void; onCopied: () => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const setHandoff = useReader((s) => s.setHandoff);
  const full = useQuery({ queryKey: ["lex-entry", e.id], queryFn: () => getJSON<{ body: string }>(`/lexicon/entries/${e.id}`), enabled: expanded, staleTime: Infinity });
  // the vowel marks shown or hidden (D7)
  const shown = useMarks();
  const text = shown(expanded && full.data ? full.data.body : e.excerpt);
  const truncated = e.length > e.excerpt.length;
  async function copy() {
    const body = full.data?.body ?? (await getJSON<{ body: string }>(`/lexicon/entries/${e.id}`)).body;
    try {
      await navigator.clipboard.writeText(body);
      onCopied();
    } catch {}
  }
  return (
    <div className="flex flex-col gap-1">
      {e.confidence === "high" && <p className="text-[11px] text-amber">{t("approxMapping", { head: e.headword })}</p>}
      {e.word?.map((p) => <WordParagraph key={p.para} p={p} lang={lang} />)}
      <div
        className={lang === "en" ? "dict-body text-[13px] leading-relaxed" : "dict-body ar-classical text-[15px] leading-[2]"}
        lang={lang === "en" ? "en" : "ar"}
        dir={lang === "en" ? "ltr" : "rtl"}
        data-collapsed={!expanded && truncated}
      >
        {text}
      </div>
      <div className="flex items-center gap-3 text-[11.5px] text-t3">
        {truncated && (
          <button type="button" className="hover:text-t1" onClick={onToggle}>
            {expanded ? t("showLess") : t("showMore", cnt(e.length, locale))}
          </button>
        )}
        {e.page_ref && <span>{e.page_ref}</span>}
        <span className="flex-1" />
        {/* the article on a map, as a note that quotes it by its id, describing its root (RDR-239) */}
        <button type="button" className="dict-act hover:text-t1" onClick={() => setHandoff({ seed: "quote", entry: e.uri ?? e.id })} aria-label={t("entryToMap")} title={t("entryToMapTitle")}>
          <Icon name="plus" size={12} />
        </button>
        <button type="button" className="dict-act hover:text-t1" onClick={copy} aria-label={t("copyEntry")} title={t("copyEntry")}>
          <Icon name="copy" size={12} />
        </button>
      </div>
    </div>
  );
}

/** The paragraph of the article on this word (P3.1: Lane per word), its words the article's, with its headword as the
 * lexicographer keys it, its page and how it was matched — above the whole article, which follows as it is. */
function WordParagraph({ p, lang }: { p: NonNullable<DictEntry["word"]>[number]; lang: string }) {
  const t = useTranslations("rd");
  const shown = useMarks();
  const [open, setOpen] = useState(false);
  const long = p.text.length > 700;
  return (
    <div className="dict-word flex flex-col gap-1 rounded-lg border border-line bg-card-2 p-2.5">
      <p className="text-[11.5px] text-t3">
        {t("laneOnWord")}{" "}
        {/* Perseus keys a few paragraphs with no Arabic word («1»): no headword is shown for those */}
        {/[\u0621-\u064a]/.test(p.headword) && <bdi className="ar-classical text-[15px] text-t1" lang="ar">{shown(p.headword)}</bdi>}
      </p>
      <div className={lang === "en" ? "dict-body text-[13px] leading-relaxed" : "dict-body ar-classical text-[15px] leading-[2]"} lang={lang === "en" ? "en" : "ar"} dir={lang === "en" ? "ltr" : "rtl"} data-collapsed={long && !open}>
        {shown(long && !open ? `${p.text.slice(0, 700)}…` : p.text)}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 text-[11px] text-t3">
        {long && (
          <button type="button" className="hover:text-t1" onClick={() => setOpen(!open)}>
            {open ? t("showLess") : t("laneWordMore")}
          </button>
        )}
        {p.page_ref && <span>{t("lanePage", { page: p.page_ref })}</span>}
        <span>{t(p.rule === "verb-form" ? "laneRule_verbForm" : "laneRule_vocalised")}</span>
      </p>
    </div>
  );
}

function Compare({ works }: { works: DictWork[] }) {
  const t = useTranslations("rd");
  const shown = useMarks();
  const locale = useLocale();
  const compare = usePrefs((s) => s.compare);
  const set = usePrefs((s) => s.set);
  const chosen = compare.filter((id) => works.some((w) => w.id === id)).slice(0, 3);
  const cols = chosen.length ? chosen : works.slice(0, 3).map((w) => w.id);
  function toggle(id: string) {
    // at most three columns, the oldest dropped first (RDR-606)
    const next = cols.includes(id) ? cols.filter((x) => x !== id) : [...cols, id].slice(-3);
    set({ compare: next });
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("lexCompare")}>
        {works.map((w) => (
          <button key={w.id} type="button" className={"chip" + (cols.includes(w.id) ? " is-on" : "")} aria-pressed={cols.includes(w.id)} onClick={() => toggle(w.id)}>
            {locale === "ar" ? w.title_ar : w.title_en}
          </button>
        ))}
      </div>
      <p className="text-[11.5px] text-t3">{t("compareNote")}</p>
      <div className="compare-grid" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(180px, 1fr))` }}>
        {cols.map((id) => {
          const w = works.find((x) => x.id === id)!;
          return (
            <div key={id} className="flex min-w-0 flex-col gap-1.5">
              <p className="text-[12px] font-semibold">{locale === "ar" ? w.title_ar : w.title_en}</p>
              <p className="text-[11px] text-t3">{deathLabel(w, locale, t)}</p>
              {w.entries.map((e) => (
                <p key={e.id} className={w.lang === "en" ? "text-[12.5px] leading-relaxed text-t2" : "ar-classical text-[14px] leading-[1.95] text-t2"} lang={w.lang === "en" ? "en" : "ar"} dir={w.lang === "en" ? "ltr" : "rtl"}>
                  {shown(e.excerpt)}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
