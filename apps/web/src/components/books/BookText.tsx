"use client";

import { useLocale, useTranslations } from "next-intl";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { WordPanel } from "@/components/text/WordPanel";
import { MarksToggle } from "@/components/ui/MarksToggle";
import { Link } from "@/i18n/navigation";
import { type BookSegment, type Cite, type ParagraphMeta, pagesAt, paragraphHref, verseHref } from "@/lib/books";
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
 * them; the editor's brackets kept as he printed them and marked as his; the printed pages a paragraph stands on where
 * the version's pages passed the check, and where a page begins inside it, marked in the text where the version marks
 * the turn exactly (B56); the verses the editor referred to as links; each paragraph's citation, ready to copy, and
 * its own address — and the chosen word's, naming the printed page it stands on.
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
    setCopied(null);
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

  // where a printed page begins inside the paragraph (B56): a mark before the piece it begins at, read aloud
  const turnMark = (v: number, page: number, key: string) => (
    <span key={key} className="bk-turn" role="note" aria-label={t("pageTurn", { page: placeLabel(v, page, page) })} lang={locale} dir="ltr">
      <span aria-hidden="true">{placeLabel(v, page, page)}</span>
    </span>
  );
  // the pieces of a paragraph, those inside the editor's brackets gathered in one mark
  const render = (segs: BookSegment[], i: number, meta: ParagraphMeta) => {
    const out: ReactNode[] = [];
    const starts: number[] = [];
    segs.reduce((at, s) => (starts.push(at), at + s.t.length), 0);
    const turns = new Map((meta.breaks ?? []).map(([o, v, page]) => [o, [v, page] as const]));
    const turnAt = (k: number) => {
      const x = turns.get(starts[k]);
      return x ? turnMark(x[0], x[1], `t${k}`) : null;
    };
    // what lies between words, cut where a page turns inside it (before «{» after «: »), never a word
    const between = (s: BookSegment, k: number): ReactNode => {
      const inside = (meta.breaks ?? []).filter(([o]) => o > starts[k] && o < starts[k] + s.t.length);
      if (!inside.length) return s.t.includes("\u2003") ? <span key={k} className="bk-hemi">{shown(s.t)}</span> : <span key={k}>{shown(s.t)}</span>;
      const out: ReactNode[] = [];
      let at = 0;
      for (const [o, v, page] of inside) {
        out.push(shown(s.t.slice(at, o - starts[k])), turnMark(v, page, `t${k}-${o}`));
        at = o - starts[k];
      }
      out.push(shown(s.t.slice(at)));
      return <span key={k}>{out}</span>;
    };
    for (let k = 0; k < segs.length; k++) {
      const s = segs[k];
      if (s.e) {
        const inside: ReactNode[] = [];
        let j = k;
        for (; j < segs.length && segs[j].e; j++) {
          const mark = turnAt(j);
          if (mark) inside.push(mark);
          inside.push(segs[j].w === undefined ? between(segs[j], j) : word(segs[j], i, j));
        }
        out.push(
          <span key={`e${k}`} className="bk-editor" title={t("editorBracket")}>
            {inside}
          </span>,
        );
        k = j - 1;
        continue;
      }
      const mark = turnAt(k);
      if (mark) out.push(mark);
      // the gap between a verse's two halves, where the version marks them
      out.push(s.w === undefined ? between(s, k) : word(s, i, k));
    }
    return out;
  };

  // a page or volume number is an identifier: its digits, no grouping
  const digits = (n: number) => (locale === "ar" ? toArabicDigits(n) : String(n));
  // a place's printed pages: «١/٢٣», «١/٢٣–٢٤», «ص ٢٣»
  const placeLabel = (v: number, from: number, to: number) => {
    const p = from === to ? digits(from) : `${digits(from)}–${digits(to)}`;
    return volumes > 1 ? t("volumePage", { v: digits(v), p }) : t("page", { p });
  };
  // the pages a paragraph stands on: one, or its first to its last
  const pageLabel = (m: ParagraphMeta) => {
    const [[v, a], [w, b]] = [m.pages![0], m.pages![m.pages!.length - 1]];
    if (v === w) return placeLabel(v, a, b);
    return `${placeLabel(v, a, a)}–${placeLabel(w, b, b)}`;
  };
  const chosen = selected === null ? null : paragraphs[selected.p];
  // the chosen word's place, cited by the printed page it stands on (B56)
  const wordCite = (() => {
    if (!chosen || selected === null || chosen.cite.by !== "page" || !chosen.cite.base) return null;
    const segs = chosen.segments;
    const k = segs.findIndex((s) => s.w === selected.w);
    if (k < 0) return null;
    const offset = segs.slice(0, k).reduce((n, s) => n + s.t.length, 0);
    const at = pagesAt(chosen.meta, offset);
    if (!at) return null;
    const p = at.from === at.to ? toArabicDigits(at.from) : `${toArabicDigits(at.from)}–${toArabicDigits(at.to)}`;
    return `${chosen.cite.base}، ${volumes > 1 ? `${toArabicDigits(at.v)}/${p}` : `ص${p}`}`;
  })();

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
            <p className="bk-body">{render(p.segments, i, p.meta)}</p>
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
        text={slug}
      >
        {/* the chosen word's place, by the printed page it stands on (B56): in the panel, so a phone's sheet shows it */}
        {wordCite && chosen && (
          <section className="flex flex-col items-start gap-1 border-t border-line pt-3" aria-label={t("wordPlace")}>
            <p className="text-[13px] font-medium">{t("wordPlace")}</p>
            <p className="ar-classical text-[16px] leading-relaxed" lang="ar" dir="rtl">{wordCite}</p>
            <button type="button" className="bk-cite-btn" onClick={() => copy(`${wordCite} — ${chosen.cite.key}`, "word")}>
              {copied === "word" ? t("copied") : t("copyCite")}
            </button>
          </section>
        )}
      </WordPanel>
    </div>
  );
}
