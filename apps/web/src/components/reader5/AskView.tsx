"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { hasArabic, hasMarks } from "@/lib/arabic/normalize";
import { cnt, formatNumber } from "@/lib/format";
import { getJSON, useWord } from "@/lib/reader/api";
import { useBreakpoint } from "@/lib/reader/media";
import { usePrefs, useReader } from "@/lib/reader/store";
import { useStar } from "@/lib/store/saved";
import type { WordPayload } from "@/lib/reader/types";
import { useDebounced } from "@/lib/useDebounced";
import { ListenOccurrence } from "./Listen";
import { PatternFunction } from "./sections/Family";

type Hit = { slug: string; ar: string; envelope: { full: string; translit: string }; gloss_en: string | null; senses_en?: string[]; root: string | null; pos: string };
const TRY = ["عِلْم", "رَحْمَة", "صَبْر", "قَلْب", "knowledge"];

/**
 * Ask mode — the plain front door (design 03 §3.3, RDR-160…188, adapted per RDR-564): one question box,
 * live matches as you type, one clear card. On phones the card becomes four swipeable cards.
 */
export function AskView() {
  const t = useTranslations("rd");
  const locale = useLocale();
  const bp = useBreakpoint();
  // Ask only renders in the browser (the shell enters it after mount), so the URL is readable here.
  const [q, setQ] = useState(() => (typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("q") ?? "")));
  const [pick, setPick] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const dq = useDebounced(q.trim(), 180);

  useEffect(() => {
    const id = setTimeout(() => input.current?.focus(), 60);
    return () => clearTimeout(id);
  }, []);

  const hits = useQuery({
    queryKey: ["ask", dq],
    queryFn: () => getJSON<{ results: { lemmas: Hit[] } }>(`/search?q=${encodeURIComponent(dq)}&limit=6`),
    enabled: dq.length > 0,
  });
  const matches = hits.data?.results.lemmas ?? [];
  const chosen = pick ?? matches[0]?.slug ?? null;

  const hint = !q
    ? null
    : hasArabic(q)
      ? hasMarks(q)
        ? t("hintArabic")
        : t("hintArabicBare")
      : /[āīūʿʾḥṣṭḍẓ]/.test(q)
        ? t("hintTranslit")
        : t("hintLatin");

  return (
    <div className="ask-view">
      <h1 className="ask-title">{t("askHeading")}</h1>
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (matches[0]) setPick(matches[0].slug);
        }}
      >
        <Icon name="search" size={18} />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPick(null);
          }}
          placeholder={bp === "phone" ? t("askPlaceholderShort") : t("askPlaceholder")}
          aria-label={t("askHeading")}
          dir="auto"
          className="ask-input"
          data-ask
        />
        {hint && <span className="ask-hint">{hint}</span>}
      </form>
      {!q && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-[12.5px] text-t3">{t("try")}</span>
          {TRY.map((w) => (
            <button key={w} type="button" className="chip" onClick={() => setQ(w)} dir="auto">
              <span className={hasArabic(w) ? "ar-classical text-[16px]" : "text-[13px]"}>{w}</span>
            </button>
          ))}
        </div>
      )}
      {dq && hits.isFetched && matches.length === 0 && <p className="text-[13.5px] text-t2">{t("askNoMatch", { q: dq })}</p>}
      {matches.length > 1 && !pick && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-[12.5px] text-t3">{t("askMatches", cnt(matches.length, locale))}</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {matches.map((m) => (
              <button key={m.slug} type="button" className={"chip" + (m.slug === chosen ? " is-on" : "")} onClick={() => setPick(m.slug)}>
                <span className="ar-classical text-[17px]" lang="ar">{m.ar}</span>
                <span className="text-[11.5px] text-t3" lang="en">{m.gloss_en ?? m.senses_en?.[0] ?? ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {chosen && <AskCard slug={chosen} phone={bp === "phone"} onCousin={(s) => setPick(s)} />}
    </div>
  );
}

function AskCard({ slug, phone, onCousin }: { slug: string; phone: boolean; onCousin: (slug: string) => void }) {
  const base = useWord(slug, null);
  const first = base.data?.attestations.items[0]?.location ?? null;
  // The contextual meaning comes from the first place the Quran uses the word.
  const atFirst = useWord(first ? slug : null, first);
  const w = atFirst.data ?? base.data;
  if (!w) return <div className="ask-card h-[280px] animate-pulse" />;
  // a new word starts its deck at the first card, dots included (RDR-530)
  return phone ? <PhoneDeck key={w.slug} w={w} onCousin={onCousin} /> : <DesktopCard w={w} onCousin={onCousin} />;
}

function useAskActions(w: WordPayload) {
  const setAsk = useReader((s) => s.setAsk);
  const openWord = useReader((s) => s.openWord);
  const setPrefs = usePrefs((s) => s.set);
  const [star, toggleStar] = useStar(w.slug, w.ar.full);
  const first = w.attestations.items[0];
  return {
    star,
    toggleStar,
    goDeeper: () => {
      setAsk(false);
      setPrefs({ panelOpen: true });
      openWord({ slug: w.slug, at: w.occurrence?.location ?? null });
    },
    readHref: first ? `/quran/${first.verse_key.split(":")[0]}?w=${encodeURIComponent(w.slug)}&at=${first.location}#v${first.verse_key.split(":")[1]}` : null,
  };
}

function meaningLine(w: WordPayload): { text: string; lang: "ar" | "en"; source: string } | null {
  const g = w.occurrence?.glosses[0];
  if (g) return { text: g.gloss, lang: "ar", source: g.attribution_ar };
  if (w.occurrence?.gloss_en) return { text: w.occurrence.gloss_en, lang: "en", source: "corpus" };
  if (w.gloss_en) return { text: w.gloss_en, lang: "en", source: "corpus" };
  return null;
}

function DesktopCard({ w, onCousin }: { w: WordPayload; onCousin: (slug: string) => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const a = useAskActions(w);
  const meaning = meaningLine(w);
  const cousins = w.family.flatMap((g) => g.members).filter((m) => m.slug !== w.slug).slice(0, 4);
  const first = w.attestations.items[0];
  return (
    <article className="ask-card" aria-label={w.ar.full}>
      <div className="ask-band">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="ar-classical text-[46px] leading-[1.4]" lang="ar" dir="rtl">{w.ar.full}</p>
            {meaning && (
              <p className={meaning.lang === "ar" ? "text-[19px] font-semibold leading-relaxed" : "text-[17px] font-semibold italic"} lang={meaning.lang} dir={meaning.lang === "ar" ? "rtl" : "ltr"}>
                {meaning.text}
              </p>
            )}
            <p className="text-[13px] text-t3">
              <span className="mono" dir="ltr">{w.ar.translit}</span> · {locale === "ar" ? w.pos.ar : w.pos.en}
              {meaning && <> · {meaning.source === "corpus" ? t("corpusGlossCredit") : meaning.source}</>}
            </p>
          </div>
          {w.occurrence && <ListenOccurrence location={w.occurrence.location} tokenFrom={w.occurrence.token_from} tokenTo={w.occurrence.token_to} />}
        </div>
      </div>
      {w.root && (
        <div className="ask-band">
          <p className="text-[14px] text-t2">
            {t("askBuiltOn")} <span className="ar-classical text-[16px] text-root" lang="ar">{w.root.ar_spaced}</span>
            {w.core_meaning && <span className="text-t3"> — {w.core_meaning.text}</span>}
          </p>
          {cousins.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="text-[12.5px] text-t3">{t("askCousins")}</span>
              {cousins.map((c) => (
                <button key={c.slug} type="button" className="chip" onClick={() => onCousin(c.slug)}>
                  <span className="ar-classical text-[20px] text-word" lang="ar">{c.ar.full}</span>
                  <span className="mono text-[10.5px] text-t3" dir="ltr">{c.ar.translit}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[12.5px] text-t3">{t("askOnlyWord")}</p>
          )}
        </div>
      )}
      {first && (
        <div className="ask-band">
          <p className="label-caps">{t("heardIn")}</p>
          <p className="quran mt-1 text-[22px] leading-[2]" lang="ar" dir="rtl">
            {first.left} <mark className="kwic-key">{first.keyword}</mark> {first.right}
          </p>
          <p className="text-[12px] text-t3">
            {first.surah_name_ar} · <span className="mono" dir="ltr">{first.verse_key}</span> · {t("occursN", cnt(w.corpus_freq, locale))}
          </p>
        </div>
      )}
      <div className="ask-foot">
        <span className="text-[12.5px] text-t3">{t("wantMore")}</span>
        <button type="button" className="btn btn-primary" onClick={a.goDeeper}>
          {t("goDeeper")}
        </button>
        {a.readHref && (
          <a className="btn" href={(locale === "en" ? "/en" : "") + a.readHref}>
            {t("readInPlace")}
          </a>
        )}
        <button type="button" className="btn" aria-pressed={a.star} onClick={a.toggleStar}>
          {a.star ? `★ ${t("saved")}` : `☆ ${t("save")}`}
        </button>
      </div>
    </article>
  );
}

function PhoneDeck({ w, onCousin }: { w: WordPayload; onCousin: (slug: string) => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const a = useAskActions(w);
  const rail = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const meaning = meaningLine(w);
  const cousins = w.family.flatMap((g) => g.members).filter((m) => m.slug !== w.slug).slice(0, 3);
  const first = w.attestations.items[0];
  const jumpTo = useReader((s) => s.jumpTo);

  // A new word starts the deck at its first card (RDR-530).
  useEffect(() => {
    rail.current?.scrollTo({ left: 0 });
  }, [w.slug]);

  function onScroll() {
    const el = rail.current;
    if (!el) return;
    const i = Math.round(Math.abs(el.scrollLeft) / (el.clientWidth * 0.86 + 10));
    setIndex(Math.max(0, Math.min(3, i)));
  }
  const cards: { cap: string; body: React.ReactNode; action?: React.ReactNode }[] = [
    {
      cap: t("deckMeaning"),
      body: (
        <>
          <p className="ar-classical text-[44px] leading-[1.4]" lang="ar" dir="rtl">{w.ar.full}</p>
          {meaning && <p className={meaning.lang === "ar" ? "text-[17px] font-semibold" : "text-[16px] font-semibold italic"} lang={meaning.lang}>{meaning.text}</p>}
          <p className="text-[12.5px] text-t3"><span className="mono" dir="ltr">{w.ar.translit}</span> · {locale === "ar" ? w.pos.ar : w.pos.en}</p>
        </>
      ),
      action: (
        <div className="flex gap-2">
          {w.occurrence && <ListenOccurrence location={w.occurrence.location} tokenFrom={w.occurrence.token_from} tokenTo={w.occurrence.token_to} />}
          <button type="button" className="btn min-h-[44px]" aria-pressed={a.star} onClick={a.toggleStar}>{a.star ? `★ ${t("saved")}` : `☆ ${t("save")}`}</button>
        </div>
      ),
    },
    {
      cap: t("deckCousins"),
      body: w.root ? (
        <>
          <p className="ar-classical text-[32px] tracking-[.08em] text-root" lang="ar">{w.root.ar_spaced}</p>
          <p className="text-[12.5px] text-t3">{t("deckRootSub")}</p>
          <ul className="flex flex-col">
            {cousins.map((c) => (
              <li key={c.slug}>
                <button type="button" className="flex min-h-[44px] w-full items-center gap-3" onClick={() => onCousin(c.slug)}>
                  <span className="ar-classical text-[19px] text-word" lang="ar">{c.ar.full}</span>
                  <span className="mono text-[11px] text-t3" dir="ltr">{c.ar.translit}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-[13px] text-t2">{t("noRootExplain")}</p>
      ),
      action: w.root ? (
        <button type="button" className="btn min-h-[44px]" onClick={() => { a.goDeeper(); jumpTo("family"); }}>{t("seeFamily")}</button>
      ) : undefined,
    },
    {
      cap: t("deckHeardIn"),
      body: first ? (
        <>
          <p className="quran text-[22px] leading-[1.9]" lang="ar" dir="rtl">{first.left} <mark className="kwic-key">{first.keyword}</mark> {first.right}</p>
          <p className="text-[12.5px] text-t3">{first.surah_name_ar} · <span className="mono" dir="ltr">{first.verse_key}</span></p>
        </>
      ) : (
        <p className="text-[13px] text-t3">{t("noAttestation")}</p>
      ),
      action: a.readHref ? (
        <a className="btn min-h-[44px]" href={(locale === "en" ? "/en" : "") + a.readHref}>{t("readInPlace")}</a>
      ) : undefined,
    },
    {
      cap: t("deckShape"),
      body: w.pattern ? (
        <>
          <p className="ar-classical text-[36px] text-form" lang="ar">{w.pattern.ar.full}</p>
          <p className="text-[14px]"><PatternFunction p={w.pattern} /></p>
          <p className="text-[12.5px] text-t3">{t("deckShapeBody", cnt(w.pattern.lemma_count, locale))}</p>
        </>
      ) : (
        <p className="text-[13px] text-t3">{t("noPattern")}</p>
      ),
      action: w.pattern ? (
        <button type="button" className="btn min-h-[44px]" onClick={() => { a.goDeeper(); jumpTo("patterns"); }}>{t("showShapes")}</button>
      ) : undefined,
    },
  ];
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div ref={rail} className="ask-deck" onScroll={onScroll}>
        {cards.map((c, i) => (
          <article key={c.cap} className="ask-deck-card" aria-label={`${c.cap} · ${i + 1}/4`}>
            <p className="label-caps">{t("deckCap", { cap: c.cap, i: formatNumber(i + 1, locale), n: formatNumber(4, locale) })}</p>
            <div className="flex flex-1 flex-col gap-2">{c.body}</div>
            {c.action}
          </article>
        ))}
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {cards.map((c, i) => (
          <span key={c.cap} className={"deck-dot" + (i === index ? " is-on" : "")} />
        ))}
      </div>
      <button type="button" className="btn btn-primary min-h-[44px] w-[86%]" onClick={a.goDeeper}>
        {t("goDeeperFull")}
      </button>
    </div>
  );
}
