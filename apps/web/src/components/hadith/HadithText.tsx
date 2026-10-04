"use client";

import { useLocale, useTranslations } from "next-intl";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { dictHref } from "@/lib/dictionary";
import type { ChainLink, Form, Segment } from "@/lib/hadith";
import { narratorHref } from "@/lib/hadith";

type Part = "isnad" | "matn" | "comment";

/**
 * A hadith's text verbatim, its isnād, matn and comment each in its own block (P11.2b), every word a button that
 * opens its reading in the panel beside it (P11.4a): how the rules read it, its root in the Quran or the dictionary,
 * the Quran's word where the form is the Quran's. A narrator's name links to his page instead — a name is no root.
 */
export function HadithText({
  segments,
  words,
  forms,
  chain,
}: {
  segments: Segment[];
  words: number[];
  forms: { [id: string]: Form };
  chain: ChainLink[];
}) {
  const t = useTranslations("hadith");
  const [selected, setSelected] = useState<number | null>(null);
  const panel = useRef<HTMLElement>(null);
  const byOrdinal = new Map(chain.map((c) => [c.ordinal, c]));
  const blocks: { part: Part; items: Segment[] }[] = [];
  for (const s of segments) {
    const part = s.p ?? "matn";
    if (!blocks.length || blocks[blocks.length - 1].part !== part) blocks.push({ part, items: [] });
    blocks[blocks.length - 1].items.push(s);
  }

  // the panel answers Escape and gives focus back to the word
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      document.querySelector<HTMLButtonElement>(`.hadith-text button[data-w="${selected}"]`)?.focus();
      setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-w]");
    if (!b) return;
    setSelected(Number(b.dataset.w));
    requestAnimationFrame(() => panel.current?.focus());
  };

  const render = (items: Segment[]) => {
    const out: React.ReactNode[] = [];
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      if (s.n !== undefined) {
        // a narrator's name: its words together, a link to his page when it is linked
        const n = s.n;
        const name: Segment[] = [];
        let j = i;
        while (j < items.length && (items[j].n === n || (items[j].w === undefined && items[j + 1]?.n === n && name.length))) name.push(items[j++]);
        i = j - 1;
        const link = byOrdinal.get(n);
        const text = name.map((x) => x.t).join("");
        out.push(
          link?.narrator ? (
            <Link key={`n${n}-${i}`} href={narratorHref(link.narrator.id)} className="hp-name" title={link.narrator.name}>
              {text}
            </Link>
          ) : (
            <span key={`n${n}-${i}`} className="hp-name is-open" title={t("linkNone")}>{text}</span>
          ),
        );
        continue;
      }
      if (s.w === undefined) {
        out.push(<span key={i}>{s.t}</span>);
        continue;
      }
      out.push(
        <button key={i} type="button" className={`w${selected === s.w ? " is-selected" : ""}`} data-w={s.w} aria-pressed={selected === s.w}>
          {s.t}
        </button>,
      );
    }
    return out;
  };

  const label: Record<Part, string> = { isnad: t("isnad"), matn: t("matn"), comment: t("comment") };
  return (
    <div className="hadith-reader">
      <div className="hadith-text" dir="rtl" lang="ar" onClick={onClick}>
        {blocks.map((b, k) => (
          <div key={k} className={`hp-${b.part}`}>
            <span className="sr-only">{label[b.part]}</span>
            <p>{render(b.items)}</p>
          </div>
        ))}
      </div>
      <WordPanel
        ref={panel}
        word={selected === null ? null : (segments.find((s) => s.w === selected)?.t ?? null)}
        form={selected === null ? null : (forms[String(words[selected])] ?? null)}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function pct(x: number, locale: string) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent", maximumFractionDigits: 0 }).format(x);
}

function WordPanel({ word, form, onClose, ref }: { word: string | null; form: Form | null; onClose: () => void; ref: React.Ref<HTMLElement> }) {
  const t = useTranslations("hadith");
  const locale = useLocale();
  const first = form?.readings[0];
  return (
    <aside ref={ref} tabIndex={-1} className={`hadith-panel${word ? " is-open" : ""}`} aria-label={t("wordTitle")} aria-live="polite">
      {!word ? (
        <p className="text-[13px] text-t3">{t("wordHint")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <p className="ar-classical flex-1 text-[30px] leading-tight" lang="ar" dir="rtl">{word}</p>
            <button type="button" className="btn" onClick={onClose}>{t("close")}</button>
          </div>
          {form && (
            <>
              <p className="flex flex-wrap gap-1.5 text-[12.5px]">
                <span className="state-chip">{t(`kind_${form.kind}` as "kind_form")}</span>
                {form.kind !== "particle" && form.kind !== "none" && <span className="state-chip">{t("readingAuto", { c: pct(form.confidence, locale) })}</span>}
              </p>
              {first?.dict_root && (
                <p className="ar-classical text-[34px] leading-none text-root" lang="ar" dir="rtl" aria-label={first.dict_root}>
                  {[...first.dict_root].join(" ")}
                </p>
              )}
              {first?.pattern_ar && <p className="text-[13px] text-t2">{t("pattern", { pattern: first.pattern_ar })}</p>}
              <p className="flex flex-wrap gap-2">
                {first?.root && <Link href={`/roots/${encodeURIComponent(first.root)}`} className="btn">{t("rootInQuran")}</Link>}
                {first?.dict_root && <Link href={dictHref(first.dict_root)} className="btn">{t("rootInDictionary")}</Link>}
                {first?.lemma && <Link href={`/read?w=${encodeURIComponent(first.lemma.slug)}`} className="btn">{t("lemmaInQuran")}</Link>}
              </p>
              {form.readings.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[12.5px] text-t3">{t("otherReadings")}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {form.readings.slice(1, 6).map((r, i) =>
                      r.dict_root ? (
                        <li key={i}>
                          <Link href={dictHref(r.dict_root)} className="state-chip ar-classical" lang="ar">{[...r.dict_root].join(" ")}</Link>
                        </li>
                      ) : null,
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
