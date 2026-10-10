"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";
import { paragraphHref } from "@/lib/books";
import { dictHref } from "@/lib/dictionary";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { hadithHref } from "@/lib/hadith";
import { looksLikeQuestion } from "@/lib/ask";
import { searchMyTexts } from "@/lib/library/searchTexts";
import type { SearchResult } from "@/lib/types";
import { useDebounced } from "@/lib/useDebounced";

type Item = { id: string; href: string; kind: string; primary: React.ReactNode; secondary?: React.ReactNode };
/** The texts beyond the Quran in a search's answer (P11): a hadith or a book's paragraph, with its place. */
type TextHit = { uri: string; ref: string; text: { slug: string; title_ar: string; title_en: string }; chapter?: { title_ar: string } | null; start: string };
type Ecosystem = { dict_roots?: { key: string; display: string; lexica: number; quran_root: string | null }[]; texts?: TextHit[]; books?: TextHit[]; semantic?: { verse: { key: string; surah: number; ayah: number; text_qpc: string } }[] };

export function Omnibox({ onClose }: { onClose: () => void }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [activeState, setActiveState] = useState<{ q: string; i: number }>({ q: "", i: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const debounced = useDebounced(q.trim(), 160);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    enabled: debounced.length > 0,
    queryFn: async () => {
      const r = await fetch(`/api/v1/search?q=${encodeURIComponent(debounced)}&limit=8`);
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as SearchResult & { results: Ecosystem };
    },
  });
  // the reader's own texts, searched in this browser and never sent (SRC-Q03)
  const mine = useQuery({ queryKey: ["search-mine", debounced], queryFn: () => searchMyTexts(debounced, 3), enabled: debounced.length > 1 });

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    // a question, not a word: asked of the Quran first (P18), whatever else the search finds
    if (debounced && looksLikeQuestion(debounced))
      out.push({ id: "ask", href: `/ask?q=${encodeURIComponent(debounced)}`, kind: t("kindAsk"), primary: <span dir="auto">{t("askThis", { q: debounced })}</span> });
    if (!data) return out;
    for (const v of data.results.verses.slice(0, 5))
      out.push({
        id: `v${v.key}`,
        href: `/quran/${v.surah}/${v.ayah}`,
        kind: t("kindVerse"),
        primary: <span className="quran line-clamp-1 text-[19px] leading-[1.9]" dir="rtl" lang="ar">{v.text_qpc}</span>,
        secondary: <span className="mono" dir="ltr">{verseRef(v.key, locale)}</span>,
      });
    // verses close in meaning (P17), after the verses holding the words: up to three, none already listed
    const listed = new Set(data.results.verses.slice(0, 5).map((v) => v.key));
    for (const { verse: v } of (data.results.semantic ?? []).filter((x) => !listed.has(x.verse.key)).slice(0, 3))
      out.push({
        id: `m-${v.key}`,
        href: `/quran/${v.surah}/${v.ayah}`,
        kind: t("kindSemantic"),
        primary: <span className="quran line-clamp-1 text-[19px] leading-[1.9]" dir="rtl" lang="ar">{v.text_qpc}</span>,
        secondary: <span className="mono" dir="ltr">{verseRef(v.key, locale)}</span>,
      });
    for (const s of data.results.surahs)
      out.push({
        id: `s${s.number}`,
        href: `/quran/${s.number}`,
        kind: t("kindSurah"),
        primary: <span className="ar-classical text-[18px]" dir="rtl" lang="ar">{`سورة ${s.name_ar}`}</span>,
        secondary: <span dir="ltr">{`${formatNumber(s.number, locale)} • ${s.name_translit}`}</span>,
      });
    for (const r of data.results.roots)
      out.push({
        id: `r${r.key}`,
        href: `/roots/${encodeURIComponent(r.key)}`,
        kind: t("kindRoot"),
        primary: <span className="ar-classical text-[19px] text-root" dir="rtl" lang="ar">{r.spaced}</span>,
        secondary: t("rootMeta", { occurrences: formatNumber(r.occurrences, locale), lemmas: formatNumber(r.lemma_count, locale) }),
      });
    for (const w of data.results.words.slice(0, 6))
      out.push({
        id: `w${w.form}-${w.lemma_id}`,
        href: `/word/${w.sample}`,
        kind: t("kindWord"),
        primary: <span className="ar-classical text-[19px]" dir="rtl" lang="ar">{w.display}</span>,
        secondary: (
          <span>
            {t("formMeta", cnt(w.occurrences, locale))}
            {w.root ? <span className="text-root" dir="rtl" lang="ar">{` • ${w.root}`}</span> : null}
          </span>
        ),
      });
    // patterns, as the reader's omnibox offers them (SHL-Q07): each opens the words built on it
    for (const p of (data.results.patterns ?? []).slice(0, 2))
      out.push({
        id: `p${p.slug}`,
        href: `/search?q=${encodeURIComponent(p.ar.full)}`,
        kind: t("kindPattern"),
        primary: <span className="ar-classical text-[19px] text-form" dir="rtl" lang="ar">{p.ar.full}</span>,
        secondary: (
          <span>
            <span dir="ltr">{p.ar.translit}</span> • {t("wordsOnPattern", cnt(p.lemma_count, locale))}
          </span>
        ),
      });
    // the ecosystem (SHL-Q07): the dictionary's roots, the hadith, the books' paragraphs
    for (const d of (data.results.dict_roots ?? []).slice(0, 2))
      out.push({
        id: `d${d.key}`,
        href: dictHref(d.key),
        kind: t("kindDictRoot"),
        primary: <span className="ar-classical text-[19px]" dir="rtl" lang="ar">{d.display}</span>,
        secondary: t("dictRootMeta", cnt(d.lexica, locale)),
      });
    for (const h of (data.results.texts ?? []).slice(0, 2))
      out.push({
        id: h.uri,
        href: hadithHref(h.text.slug, h.ref),
        kind: t("kindHadith"),
        primary: <span className="ar-classical line-clamp-1 text-[16px] leading-[1.8]" dir="rtl" lang="ar">{h.start}</span>,
        secondary: <span dir="auto">{`${locale === "ar" ? h.text.title_ar : h.text.title_en} • ${formatNumber(Number(h.ref.split(/[._]/)[0]) || 0, locale)}`}</span>,
      });
    for (const h of (data.results.books ?? []).slice(0, 2))
      out.push({
        id: h.uri,
        href: paragraphHref(h.text.slug, h.ref),
        kind: t("kindBook"),
        primary: <span className="ar-classical line-clamp-1 text-[16px] leading-[1.8]" dir="rtl" lang="ar">{h.start}</span>,
        secondary: <span dir="auto">{[h.text.title_ar, h.chapter?.title_ar].filter(Boolean).join(" • ")}</span>,
      });
    for (const h of mine.data?.hits ?? [])
      out.push({
        id: `m${h.id}-${h.passage}`,
        href: `/library/text/${h.id}#p${h.passage}`,
        kind: t("kindMine"),
        primary: <span className="ar-classical line-clamp-1 text-[16px] leading-[1.8]" dir="rtl" lang="ar">{`${h.before} ${h.match} ${h.after}`.trim()}</span>,
        secondary: t("mineIn", { title: h.title, n: formatNumber(h.passage, locale) }),
      });
    for (const l of data.results.lemmas.slice(0, 4))
      if (l.root)
        out.push({
          id: `l${l.id}`,
          href: `/roots/${encodeURIComponent(l.root)}#lemma-${l.id}`,
          kind: t("kindLemma"),
          primary: <span className="ar-classical text-[19px]" dir="rtl" lang="ar">{l.ar}</span>,
          secondary: l.gloss_en && locale === "en" ? l.gloss_en : t("formMeta", cnt(l.occurrences, locale)),
        });
    return out;
  }, [data, mine.data, t, locale, debounced]);

  // The highlighted row resets whenever the query changes.
  const active = activeState.q === debounced ? activeState.i : 0;
  const setActive = (v: number | ((i: number) => number)) =>
    setActiveState({ q: debounced, i: typeof v === "function" ? v(active) : v });
  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function go(item: Item | undefined) {
    if (item) {
      router.push(item.href);
      onClose();
    } else if (q.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      onClose();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(10,10,16,.32)] px-4 pt-[10vh] animate-fade" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("dialogLabel")}
        className="popover w-full max-w-[640px] overflow-hidden p-0"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Icon name="search" size={16} className="text-t3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            // an Arabic or a Latin query reads in its own direction (SHL-F08)
            dir="auto"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-t3"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="btn" onClick={onClose}>
            {t("esc")}
          </button>
        </div>
        {data && (
          <p className="border-b border-line px-4 py-2 text-[12px] text-t3" aria-live="polite">
            {t("understood", { kind: locale === "ar" ? data.detected.label_ar : data.detected.label_en })}
          </p>
        )}
        <ul id={listId} role="listbox" className="max-h-[60vh] overflow-y-auto p-1.5">
          {items.map((it, i) => (
            <li
              key={it.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(it)}
              className={"flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 " + (i === active ? "bg-card-2" : "")}
            >
              <span className="w-14 shrink-0 text-[11.5px] text-t3">{it.kind}</span>
              <span className="min-w-0 flex-1 truncate">{it.primary}</span>
              {it.secondary && <span className="shrink-0 text-[12px] text-t3">{it.secondary}</span>}
            </li>
          ))}
          {debounced && data && items.length === 0 && !isFetching && (
            <li className="px-3 py-6 text-center text-t2">{t("noResults")}</li>
          )}
          {!debounced && <li className="px-3 py-5 text-[13px] text-t3">{t("hint")}</li>}
        </ul>
        {debounced && (
          <button type="button" className="w-full border-t border-line px-4 py-3 text-start text-[13px] text-t2 hover:bg-card-2" onClick={() => go(undefined)}>
            {t("allResults", { q: debounced })}
          </button>
        )}
      </div>
    </div>
  );
}
