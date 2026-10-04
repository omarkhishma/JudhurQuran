"use client";

import { useLocale, useTranslations } from "next-intl";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { WordPanel } from "@/components/text/WordPanel";
import { MarksToggle } from "@/components/ui/MarksToggle";
import { Link } from "@/i18n/navigation";
import type { ChainLink, Form, Segment } from "@/lib/hadith";
import { narratorHref } from "@/lib/hadith";
import { useMarks } from "@/lib/reader/marks";

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
  place,
  text,
}: {
  segments: Segment[];
  words: number[];
  forms: { [id: string]: Form };
  chain: ChainLink[];
  /** this hadith's address and name, for the way back to it (SHL-Q09) */
  place?: { href: string; label: string };
  /** the collection's slug: the chosen word's places in it */
  text?: string;
}) {
  const t = useTranslations("hadith");
  const locale = useLocale();
  // the vowel marks shown or hidden (D7): the reader's choice, the text itself never changed
  const shown = useMarks();
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
        const text = shown(name.map((x) => x.t).join(""));
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
        out.push(<span key={i}>{shown(s.t)}</span>);
        continue;
      }
      out.push(
        <button key={i} type="button" className={`w${selected === s.w ? " is-selected" : ""}`} data-w={s.w} aria-pressed={selected === s.w}>
          {shown(s.t)}
        </button>,
      );
    }
    return out;
  };

  const label: Record<Part, string> = { isnad: t("isnad"), matn: t("matn"), comment: t("comment") };
  return (
    <div className="hadith-reader">
      <div className="flex min-w-0 flex-col gap-2">
      <div className="text-tools" lang={locale}>
        <MarksToggle />
      </div>
      <div className="hadith-text" dir="rtl" lang="ar" onClick={onClick}>
        {blocks.map((b, k) => (
          <div key={k} className={`hp-${b.part}`}>
            <span className="sr-only">{label[b.part]}</span>
            <p>{render(b.items)}</p>
          </div>
        ))}
      </div>
      </div>
      <WordPanel
        ref={panel}
        word={selected === null ? null : (segments.find((s) => s.w === selected)?.t ?? null)}
        form={selected === null ? null : (forms[String(words[selected])] ?? null)}
        onClose={() => setSelected(null)}
        place={place}
        text={text}
      />
    </div>
  );
}
