"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { colourVar, fetchCoverage, type SetCard, type SetDetail, type SetItem } from "@/lib/collections";
import type { WordOfTheDay } from "@/lib/daily";
import { cnt, formatNumber, toArabicDigits, verseRef } from "@/lib/format";
import { encodeSeed } from "@/lib/graph/seedCodec";
import { getJSON } from "@/lib/reader/api";
import { usePersonal, type WordState } from "@/lib/reader/store";
import { StudyDeck } from "./StudyDeck";

const pct = (x: number, locale: string) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent", maximumFractionDigits: 1 }).format(x);
const met = (s: WordState | undefined) => s === "learning" || s === "known";

/**
 * Explore (06 §6.2, inventory COL-01…54 with the Quran notes COL-Q01…Q07): the word of the day with its root,
 * its root's statement in Ibn Fāris's words and its first verse; progress as words met and how much of the
 * Quran they cover — no streak, no loss (COL-13); the curated sets, each opening as a guided walk with Open
 * and Keep per word, the roots it touches, the set as a map, and a study deck.
 */
export function ExploreScreen({ sets, word, wotdLabel, setId, initialSet }: { sets: SetCard[]; word: WordOfTheDay | null; wotdLabel: string; setId: string | null; initialSet: SetDetail | null }) {
  const t = useTranslations("explore");
  return (
    <div className="explore-screen">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold">{t("title")}</h1>
        <span className="flex-1" />
        <Link href="/read?mode=ask" className="btn">{t("askAction")}</Link>
      </div>
      {setId ? (
        <SetView id={setId} initial={initialSet} />
      ) : (
        <>
          <div className="explore-top">
            <WordOfTheDayCard w={word} label={wotdLabel} />
            <ProgressCard />
          </div>
          <section className="flex flex-col gap-3" aria-labelledby="explore-sets">
            <div>
              <h2 id="explore-sets" className="text-[15px] font-semibold">{t("sets")}</h2>
              <p className="text-[12.5px] text-t3">{t("setsSub")}</p>
            </div>
            <ul className="set-grid">
              {sets.map((s) => (
                <li key={s.id}>
                  <SetCardView s={s} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function WordOfTheDayCard({ w, label }: { w: WordOfTheDay | null; label: string }) {
  const t = useTranslations("explore");
  const locale = useLocale();
  if (!w) return <div className="wotd-card is-missing" role="alert">{t("wotdMissing")}</div>;
  const at = w.attestation;
  return (
    <article className="wotd-card" aria-labelledby="wotd-word">
      <p className="wotd-label">
        <span>{t("wotd")}</span> • <span>{label}</span>
      </p>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <Link id="wotd-word" href={`/read?mode=ask&q=${encodeURIComponent(w.lemma.ar.full)}`} className="wotd-word" lang="ar" dir="rtl">
          {w.lemma.ar.full}
        </Link>
        <span className="wotd-sub" dir="ltr" lang="en">
          {w.lemma.ar.translit}
          {locale !== "ar" && w.lemma.gloss_en ? ` — ${w.lemma.gloss_en}` : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Link href={`/roots/${encodeURIComponent(w.root.key)}`} className="wotd-pill">
          {t("wotdRoot", { root: w.root.ar_spaced })}
        </Link>
        {w.pattern && (
          <span className="wotd-pill">{t("wotdPattern", { pattern: w.pattern.ar.full })}</span>
        )}
        <span className="wotd-pill">{t("inQuran", cnt(w.lemma.occurrences, locale))}</span>
      </div>
      {w.gist && (
        <blockquote className="wotd-gist" lang="ar" dir="rtl">
          «{w.gist.text_ar}»
          <cite className="not-italic">
            {" "}— {t("wotdGistBy", locale === "ar" ? { author: w.gist.work.author_ar, title: w.gist.work.title_ar } : { author: w.gist.work.author_en, title: w.gist.work.title_en })}
            {w.gist.page_ref ? ` ${locale === "ar" ? toArabicDigits(w.gist.page_ref) : w.gist.page_ref}` : ""}
          </cite>
        </blockquote>
      )}
      <figure className="wotd-verse">
        <figcaption className="text-[11.5px] opacity-80">{t("wotdFirst")}</figcaption>
        <p className="quran text-[20px] leading-[2]" lang="ar" dir="rtl">
          {at.tokens.map((tok, i) => (
            <span key={i}>
              {i + 1 >= at.token_from && i + 1 <= at.token_to ? <mark className="wotd-mark">{tok}</mark> : tok}{" "}
            </span>
          ))}
        </p>
        {locale !== "ar" && at.translation && (
          <p className="text-[13px] leading-relaxed opacity-90" lang="en">
            {at.translation.text}
            {at.translation_work && <span className="opacity-80"> — {at.translation_work.title_en}</span>}
          </p>
        )}
        <Link href={`/quran/${at.surah.number}/${at.ayah}`} className="text-[12px] underline-offset-2 hover:underline">
          {locale === "ar" ? `${at.surah.name_ar}: ${formatNumber(at.ayah, locale)}` : `${at.surah.name_translit} ${at.verse_key}`}
        </Link>
      </figure>
      <p className="text-[11.5px] opacity-75">{t("wotdNote")}</p>
    </article>
  );
}

function ProgressCard() {
  const t = useTranslations("explore");
  const locale = useLocale();
  const client = useIsClient();
  const states = usePersonal((s) => s.wordStates);
  const slugs = client ? Object.keys(states).filter((k) => met(states[k])).sort() : [];
  const known = slugs.filter((s) => states[s] === "known").length;
  // how far the reader's words reach (COL-Q04): sent in a POST body, never kept
  const cov = useQuery({ queryKey: ["coverage", slugs.join(",")], queryFn: () => fetchCoverage(slugs), enabled: slugs.length > 0, staleTime: Infinity });
  return (
    <section className="progress-card" aria-labelledby="explore-progress">
      <p id="explore-progress" className="label-caps">{t("progress")}</p>
      <p className="text-[28px] font-semibold leading-tight">{t("met", cnt(slugs.length, locale))}</p>
      {slugs.length > 0 && (
        <p className="text-[12.5px] text-t2">
          {t("metSplit", { known: formatNumber(known, locale), learning: formatNumber(slugs.length - known, locale), roots: formatNumber(cov.data?.roots ?? 0, locale) })}
        </p>
      )}
      {cov.data && cov.data.coverage > 0 && <p className="text-[12.5px] text-t2">{t("coverage", { pct: pct(cov.data.coverage, locale) })}</p>}
      <p className="mt-auto text-[11.5px] text-t3">{t("noStreaks")}</p>
    </section>
  );
}

function SetCardView({ s }: { s: SetCard }) {
  const t = useTranslations("explore");
  const locale = useLocale();
  const client = useIsClient();
  const states = usePersonal((x) => x.wordStates);
  const k = client ? s.slugs.filter((slug) => met(states[slug])).length : 0;
  const status = k === 0 ? t("statusNew") : k === s.item_count ? t("statusDone") : t("statusPart", { k: formatNumber(k, locale), n: formatNumber(s.item_count, locale) });
  return (
    // a set opens on its own URL, pushed, so Back returns to the list (COL-18 fixed, COL-45)
    <Link href={`/explore?set=${s.id}`} className="set-card" style={{ borderTopColor: colourVar(s.colour) }}>
      <span className="text-[15px] font-semibold">{locale === "ar" ? s.title_ar : s.title_en}</span>
      <span className="text-[12px] text-t3">{t("setMeta", { words: t("words", cnt(s.item_count, locale)), roots: t("roots", cnt(s.root_count, locale)) })}</span>
      <span className="ar-classical text-[17px] text-t2" lang="ar" dir="rtl">{s.sample.join(" • ")}</span>
      <span className={"text-[11.5px] " + (k === 0 ? "text-t3" : k === s.item_count ? "text-good" : "text-amber")}>{status}</span>
    </Link>
  );
}

function SetView({ id, initial }: { id: string; initial: SetDetail | null }) {
  const t = useTranslations("explore");
  const locale = useLocale();
  const router = useRouter();
  const [deck, setDeck] = useState(false);
  const q = useQuery({ queryKey: ["collection", id], queryFn: () => getJSON<SetDetail>(`/collections/${encodeURIComponent(id)}`), initialData: initial ?? undefined, staleTime: Infinity, retry: false });
  const s = q.data;
  if (q.isLoading) return <div className="h-60 animate-pulse rounded-xl bg-card-2" role="status" aria-label={t("loading")} />;
  if (!s)
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-[14px] text-t2" role="alert">{t("setMissing")}</p>
        <Link href="/explore" className="btn">{t("back")}</Link>
      </div>
    );
  const ar = locale === "ar";
  const intro = (ar ? s.intro_ar : s.intro_en).replace("{coverage}", pct(s.coverage, locale));
  const seed = encodeSeed({ seed: "trail", steps: s.items.map((x) => ({ kind: "word" as const, id: x.slug })) });
  return (
    <div className="set-view">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn" onClick={() => router.push("/explore")}>{t("back")}</button>
          <h2 className="text-[20px] font-semibold" style={{ color: colourVar(s.colour) }}>{ar ? s.title_ar : s.title_en}</h2>
          <span className="text-[12px] text-t3">{t("words", cnt(s.item_count, locale))}</span>
        </div>
        <p className="max-w-[640px] text-[14px] leading-relaxed text-t2">{intro}</p>
        {s.quote && (
          <figure className="set-quote">
            <figcaption className="label-caps">{t("ruleQuote")}</figcaption>
            <blockquote className="ar-classical text-[17px] leading-[1.9]" lang="ar" dir="rtl">«{s.quote.text_ar}»</blockquote>
            <cite className="text-[11.5px] not-italic text-t3">{ar ? s.quote.attribution_ar : s.quote.attribution_en}</cite>
          </figure>
        )}
        {s.source && <p className="text-[12px] text-t3">{t("sourceLine", { work: ar ? s.source.work_ar : s.source.work_en })}</p>}
        <ol className="set-items">
          {s.items.map((x) => (
            <li key={x.slug}>
              <SetItemRow x={x} />
            </li>
          ))}
        </ol>
      </div>
      <aside className="set-side" aria-label={t("why")}>
        <p className="label-caps">{t("why")}</p>
        <p className="text-[13.5px] leading-relaxed text-t2">{ar ? s.why_ar : s.why_en}</p>
        {s.roots.length > 0 && (
          <>
            <p className="label-caps mt-2">{t("rootsInSet")}</p>
            <ul className="flex flex-wrap gap-1.5">
              {s.roots.map((r) => (
                <li key={r.key}>
                  <Link href={`/concordance?root=${encodeURIComponent(r.key)}`} prefetch={false} className="root-chip" lang="ar">{r.spaced}</Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-3 flex flex-col gap-2">
          <button type="button" className="btn btn-primary" onClick={() => setDeck(true)}>{t("study")}</button>
          <Link href={`/graph/seed?s=${seed}`} className="btn">{t("asMap")}</Link>
          <Link href="/read?mode=review" className="btn">{t("reviewKept")}</Link>
        </div>
      </aside>
      {deck && <StudyDeck title={ar ? s.title_ar : s.title_en} items={s.items} onClose={() => setDeck(false)} />}
    </div>
  );
}

/** One word of a set (COL-32…35, 52): its headword, what it is, its root as a chip, its count and first
 * place, Open (the Ask card) and Keep (learning → known → off), saved at once. */
function SetItemRow({ x }: { x: SetItem }) {
  const t = useTranslations("explore");
  const locale = useLocale();
  const client = useIsClient();
  const state = usePersonal((s) => s.wordStates[x.slug]);
  const setState = usePersonal((s) => s.setWordState);
  const shown = client ? state : undefined;
  const next: WordState = shown === "learning" ? "known" : shown === "known" ? "new" : "learning";
  return (
    <div className="set-item">
      <span className="mono text-[11px] text-t3">{formatNumber(x.ordinal, locale).padStart(2, locale === "ar" ? "٠" : "0")}</span>
      <Link href={`/read?w=${encodeURIComponent(x.slug)}`} className="ar-classical min-w-[110px] text-[28px] leading-tight text-word" lang="ar" dir="rtl">{x.ar.full}</Link>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13.5px] text-t1">{locale === "ar" ? (x.pos.ar ?? "") : (x.gloss_en ?? x.pos.en ?? "")}</span>
        <span className="text-[12px] text-t3">
          <span dir="ltr" lang="en">{x.ar.translit}</span>
          {x.pattern && (
            <>
              {" • "}
              <span className="ar-classical text-[14px]" lang="ar">{x.pattern.ar.full}</span>
            </>
          )}
          {" • "}
          {t("inQuran", cnt(x.occurrences, locale))}
          {x.first && (
            <>
              {" • "}
              <Link href={`/word/${x.first.location}`} prefetch={false} className="underline-offset-2 hover:underline">{t("firstAt", { ref: verseRef(x.first.verse_key, locale) })}</Link>
            </>
          )}
        </span>
      </span>
      {x.root ? (
        <Link href={`/concordance?root=${encodeURIComponent(x.root.key)}`} prefetch={false} className="root-chip" lang="ar">{x.root.spaced}</Link>
      ) : (
        <span className="text-[11.5px] text-t3">{t("noRoot")}</span>
      )}
      <span className="flex gap-1.5">
        <Link href={`/read?mode=ask&q=${encodeURIComponent(x.ar.full)}`} prefetch={false} className="btn">{t("open")}</Link>
        <button
          type="button"
          className={"btn keep-btn" + (shown === "learning" ? " is-learning" : shown === "known" ? " is-known" : "")}
          onClick={() => setState(x.slug, next)}
          title={t("keepHint")}
          aria-pressed={shown === "learning" || shown === "known"}
        >
          {shown === "learning" ? t("learning") : shown === "known" ? t("known") : t("keep")}
        </button>
      </span>
    </div>
  );
}
