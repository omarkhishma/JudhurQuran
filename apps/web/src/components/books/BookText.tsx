"use client";

import { useLocale, useTranslations } from "next-intl";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { WordPanel } from "@/components/text/WordPanel";
import { MarksToggle } from "@/components/ui/MarksToggle";
import { Link } from "@/i18n/navigation";
import { type BookSegment, type Cite, type ParagraphMeta, paragraphHref, verseHref } from "@/lib/books";
import { formatNumber, toArabicDigits } from "@/lib/format";
import type { Form } from "@/lib/hadith";
import { useMarks } from "@/lib/reader/marks";

export type ReaderParagraph = {
  ref: string;
  meta: ParagraphMeta;
  cite: Cite;
  segments: BookSegment[];
  words: number[];
  /** the heading of the section it opens, on a page that runs over several */
  heading?: string | null;
  headingHref?: string;
};

/**
 * A book's paragraphs as the author wrote them (P11.3), every word a button that opens its reading in the panel beside
 * them; the editor's brackets kept as he printed them and marked as his; the printed page a paragraph opens on where
 * the version's pages passed the check; the verses the editor referred to as links; each paragraph's citation, ready to
 * copy, and its own address.
 */
export function BookText({
  slug,
  paragraphs,
  forms,
  surahs,
  volumes,
  linkParagraphs = true,
  title,
}: {
  slug: string;
  /** the book's title, naming the place a word was looked up in (SHL-Q09) */
  title?: string;
  paragraphs: ReaderParagraph[];
  forms: { [id: string]: Form };
  surahs: { [n: number]: string };
  volumes: number;
  linkParagraphs?: boolean;
}) {
  const t = useTranslations("books");
  // the vowel marks shown or hidden (D7): the reader's choice, the text itself never changed
  const shown = useMarks();
  const locale = useLocale();
  const [selected, setSelected] = useState<{ p: number; w: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      document.querySelector<HTMLButtonElement>(`.book-text button[data-p="${selected.p}"][data-w="${selected.w}"]`)?.focus();
      setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const onClick = (e: MouseEvent<HTMLOListElement>) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-w]");
    if (!b) return;
    setSelected({ p: Number(b.dataset.p), w: Number(b.dataset.w) });
    requestAnimationFrame(() => panel.current?.focus());
  };

  async function copy(text: string, ref: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(ref);
    } catch {}
  }

  const word = (s: BookSegment, i: number, k: number) => {
    const on = selected?.p === i && selected.w === s.w;
    return (
      <button key={k} type="button" className={`w${on ? " is-selected" : ""}`} data-p={i} data-w={s.w} aria-pressed={on}>
        {shown(s.t)}
      </button>
    );
  };

  // the pieces of a paragraph, those inside the editor's brackets gathered in one mark
  const render = (segs: BookSegment[], i: number) => {
    const out: ReactNode[] = [];
    for (let k = 0; k < segs.length; k++) {
      const s = segs[k];
      if (s.e) {
        const inside: ReactNode[] = [];
        let j = k;
        for (; j < segs.length && segs[j].e; j++) inside.push(segs[j].w === undefined ? <span key={j}>{shown(segs[j].t)}</span> : word(segs[j], i, j));
        out.push(
          <span key={`e${k}`} className="bk-editor" title={t("editorBracket")}>
            {inside}
          </span>,
        );
        k = j - 1;
        continue;
      }
      // the gap between a verse's two halves, where the version marks them
      const piece = s.t.includes("\u2003") ? <span key={k} className="bk-hemi">{shown(s.t)}</span> : <span key={k}>{shown(s.t)}</span>;
      out.push(s.w === undefined ? piece : word(s, i, k));
    }
    return out;
  };

  // a page or volume number is an identifier: its digits, no grouping
  const digits = (n: number) => (locale === "ar" ? toArabicDigits(n) : String(n));
  const pageLabel = (m: ParagraphMeta) => {
    const [v, p] = m.pages![0];
    return volumes > 1 ? t("volumePage", { v: digits(v), p: digits(p) }) : t("page", { p: digits(p) });
  };
  const chosen = selected === null ? null : paragraphs[selected.p];

  return (
    <div className="hadith-reader">
      <div className="flex min-w-0 flex-col gap-2">
      <div className="text-tools" lang={locale}>
        <MarksToggle />
      </div>
      <ol className="book-text" dir="rtl" lang="ar" onClick={onClick}>
        {paragraphs.map((p, i) => (
          <li key={p.ref} id={`p${p.ref}`} className="bk-para">
            {p.heading && p.headingHref && (
              <h2 className="bk-heading">
                <Link href={p.headingHref}>{p.heading}</Link>
              </h2>
            )}
            <p className="bk-side" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
              {p.cite.by === "page" && p.meta.pages && <span className="bk-page">{pageLabel(p.meta)}</span>}
              {p.meta.editor_number && <span className="bk-number" title={t("editorNumber")}>[{locale === "ar" ? toArabicDigits(p.meta.editor_number) : p.meta.editor_number}]</span>}
            </p>
            <p className="bk-body">{render(p.segments, i)}</p>
            {p.meta.quran_refs && p.meta.quran_refs.length > 0 && (
              <p className="bk-refs" dir={locale === "ar" ? "rtl" : "ltr"} lang={locale}>
                <span className="text-t3">{t("versesReferred")}</span>
                {p.meta.quran_refs.map(([s, a, b], k) => (
                  <Link key={k} href={verseHref(s, a)} className="bk-ref">
                    {surahs[s] ?? formatNumber(s, locale)} {formatNumber(a, locale)}
                    {b !== a ? `–${formatNumber(b, locale)}` : ""}
                  </Link>
                ))}
              </p>
            )}
            <p className="bk-cite" dir="rtl" lang="ar">
              <span className="bk-cite-text">{p.cite.ar}</span>
              <button type="button" className="bk-cite-btn" onClick={() => copy(`${p.cite.ar} — ${p.cite.key}`, p.ref)} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
                {copied === p.ref ? t("copied") : t("copyCite")}
              </button>
              {linkParagraphs && (
                <Link href={paragraphHref(slug, p.ref)} className="bk-cite-btn" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} aria-label={t("openParagraph", { cite: p.cite.ar })}>
                  {t("paragraphLink")}
                </Link>
              )}
            </p>
          </li>
        ))}
      </ol>
      </div>
      <WordPanel
        ref={panel}
        word={chosen ? (chosen.segments.find((s) => s.w === selected!.w)?.t ?? null) : null}
        form={chosen ? (forms[String(chosen.words[selected!.w])] ?? null) : null}
        onClose={() => setSelected(null)}
        hint={t("wordHint")}
        place={chosen && title ? { href: paragraphHref(slug, chosen.ref), label: title } : null}
      />
    </div>
  );
}
