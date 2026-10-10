"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useRouter } from "@/i18n/navigation";
import { type AskPayload, askQuery, INTENTS, type Intent, type Reading, SUPERLATIVES, TWO_TERMS, type Understood } from "@/lib/ask";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { AnswerView, ThemeView } from "./Answers";

export type SurahName = { number: number; name_ar: string; name_translit: string };

/**
 * «اسأل القرآن» (P18.3, D35): a question in Arabic or English, read as an intent and its terms and answered from the
 * data and the sources. What it was understood as stands above the answer as fields the reader can change — the
 * intent, the word or root, the second word, the sūra, Meccan or Medinan — and "answer this" asks again with the
 * reading itself. The address carries the question and the reading, so an answer can be shared as it is.
 */
export function AskScreen({ initialQ, initialReading, initial, surahs }: { initialQ: string; initialReading: Reading | null; initial: AskPayload | null; surahs: SurahName[] }) {
  const t = useTranslations("ask");
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [asked, setAsked] = useState<{ q: string; reading: Reading | null }>({ q: initialQ, reading: initialReading });
  const qs = askQuery(asked.q, asked.reading);
  const res = useQuery({
    queryKey: ["ask-quran", qs],
    queryFn: () => getJSON<AskPayload>(`/ask?${qs}`),
    enabled: !!(asked.q || asked.reading),
    initialData: qs === askQuery(initialQ, initialReading) && initial ? initial : undefined,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  // the address follows what is asked (without a navigation that would render the page again)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = qs;
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url.href);
  }, [qs]);

  const ask = (text: string) => {
    const v = text.trim();
    if (v) setAsked({ q: v, reading: null });
  };
  const data = asked.q || asked.reading ? res.data : undefined;

  return (
    <div className="flex flex-col gap-5">
      <form
        role="search"
        aria-label={t("label")}
        className="askq-box"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <Icon name="search" size={18} className="shrink-0 text-t3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")} aria-label={t("label")} dir="auto" enterKeyHint="search" className="askq-input" maxLength={300} />
        <button type="submit" className="btn btn-primary">{t("submit")}</button>
      </form>
      {!asked.q && !asked.reading && (
        <div className="flex flex-col gap-2">
          <p className="label-caps">{t("examplesLabel")}</p>
          <ul className="flex flex-wrap gap-2">
            {["ex1", "ex2", "ex3", "ex4", "ex5", "ex6", "ex7", "ex8"].map((k) => (
              <li key={k}>
                <button type="button" className="chip min-h-[40px] text-start" dir="auto" onClick={() => { setQ(t(k)); ask(t(k)); }}>
                  {t(k)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {res.isError && (
        <p className="rounded-xl border border-line bg-card p-4 text-[13px] text-bad" role="alert">
          {t("error")} <button type="button" className="underline" onClick={() => res.refetch()}>{t("retry")}</button>
        </p>
      )}
      {(asked.q || asked.reading) && !data && res.isFetching && <div className="h-40 animate-pulse rounded-xl bg-card-2" role="status" aria-label={t("loading")} />}
      {data && (
        <div className="flex flex-col gap-4" aria-busy={res.isFetching}>
          <UnderstoodPanel
            key={JSON.stringify(data.understood)}
            u={data.understood}
            surahs={surahs}
            onApply={(reading) => setAsked({ q: asked.q, reading })}
          />
          <section aria-labelledby="ask-answer" className="card flex flex-col gap-3 p-4 sm:p-5" data-kind={data.answer.kind}>
            <h2 id="ask-answer" className="label-caps">{t("answerLabel")}</h2>
            <AnswerView a={data.answer} u={data.understood} surahs={surahs} onPage={() => router.refresh()} reading={asked.reading} q={asked.q} />
          </section>
          {data.fallback && (
            <section aria-labelledby="ask-fallback" className="card flex flex-col gap-3 p-4 sm:p-5">
              <h2 id="ask-fallback" className="text-[14px] font-semibold">{t("fallbackLead")}</h2>
              <ThemeView a={data.fallback} />
            </section>
          )}
          <p className="text-[11.5px] leading-relaxed text-t3">{t("noModel")}</p>
        </div>
      )}
    </div>
  );
}

/** What the question was understood as, every part of it a field: change one and answer again. */
function UnderstoodPanel({ u, surahs, onApply }: { u: Understood; surahs: SurahName[]; onApply: (r: Reading) => void }) {
  const t = useTranslations("ask");
  const locale = useLocale();
  const [intent, setIntent] = useState<Intent>(u.intent);
  const [a, setA] = useState(u.intent === "superlative" || u.intent === "surah" ? (u.focus ?? "") : (u.a?.text ?? ""));
  const [b, setB] = useState(u.b?.text ?? "");
  const [surah, setSurah] = useState<number | "">(u.surah ?? "");
  const [place, setPlace] = useState<"" | "meccan" | "medinan">(u.place ?? "");
  const two = TWO_TERMS.includes(intent);
  const scoped = intent === "count" || intent === "surah";
  const how = u.how === "example" ? t("howExample", { example: u.example ?? "" }) : t(`how_${u.how}`);
  const subject = (term: typeof u.a) =>
    term?.subject ? (
      <span className="text-[12px] text-t2" lang="ar">
        {term.subject.kind === "root" ? t("isRoot", { root: term.subject.spaced }) : term.subject.root_spaced ? t("isWordOfRoot", { word: term.subject.ar, root: term.subject.root_spaced }) : t("isWord", { word: term.subject.ar })}
      </span>
    ) : term?.text && intent !== "theme" ? (
      <span className="text-[12px] text-amber">{t("notFound")}</span>
    ) : null;
  return (
    <section aria-labelledby="askq-understood" className="askq-understood">
      <h2 id="askq-understood" className="text-[13px] font-semibold text-t1">{t("understood")}</h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onApply({ intent, a: a.trim() || undefined, b: two ? b.trim() || undefined : undefined, surah: surah || undefined, place: intent === "count" ? place || undefined : undefined });
        }}
      >
        <label className="askq-field">
          <span>{t("fieldIntent")}</span>
          <select value={intent} onChange={(e) => { setIntent(e.target.value as Intent); if (e.target.value === "superlative") setA(SUPERLATIVES[0]); }}>
            {INTENTS.map((i) => (
              <option key={i} value={i}>{t(`intent_${i}`)}</option>
            ))}
          </select>
        </label>
        {intent === "superlative" ? (
          <label className="askq-field">
            <span>{t("fieldFocus")}</span>
            <select value={a} onChange={(e) => setA(e.target.value)}>
              {SUPERLATIVES.map((f) => (
                <option key={f} value={f}>{t(`focus_${f}`)}</option>
              ))}
            </select>
          </label>
        ) : intent === "surah" ? (
          <label className="askq-field">
            <span>{t("fieldSurahFocus")}</span>
            <select value={a} onChange={(e) => setA(e.target.value)}>
              {["", "verses", "words", "roots"].map((f) => (
                <option key={f} value={f}>{t(`surahFocus_${f || "all"}`)}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="askq-field">
            <span>{intent === "theme" ? t("fieldTheme") : t("fieldA")}</span>
            <input value={a} onChange={(e) => setA(e.target.value)} dir="auto" maxLength={120} />
            {subject(u.a)}
          </label>
        )}
        {two && (
          <label className="askq-field">
            <span>{t("fieldB")}</span>
            <input value={b} onChange={(e) => setB(e.target.value)} dir="auto" maxLength={120} />
            {subject(u.b)}
          </label>
        )}
        {scoped && (
          <label className="askq-field">
            <span>{t("fieldSurah")}</span>
            <select value={surah} onChange={(e) => setSurah(e.target.value ? Number(e.target.value) : "")}>
              {intent === "count" && <option value="">{t("anySurah")}</option>}
              {surahs.map((s) => (
                <option key={s.number} value={s.number}>{`${formatNumber(s.number, locale)}. ${locale === "ar" ? s.name_ar : s.name_translit}`}</option>
              ))}
            </select>
          </label>
        )}
        {intent === "count" && (
          <label className="askq-field">
            <span>{t("fieldPlace")}</span>
            <select value={place} onChange={(e) => setPlace(e.target.value as "" | "meccan" | "medinan")}>
              <option value="">{t("placeAll")}</option>
              <option value="meccan">{t("placeMeccan")}</option>
              <option value="medinan">{t("placeMedinan")}</option>
            </select>
          </label>
        )}
        <button type="submit" className="btn min-h-[40px]">{t("apply")}</button>
      </form>
      <p className="text-[11.5px] text-t3">{how}</p>
    </section>
  );
}
