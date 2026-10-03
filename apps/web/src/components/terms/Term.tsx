"use client";

import { useLocale } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { useGlossary } from "@/lib/reader/api";
import { type SectionId, usePrefs as useReaderPrefs, useReader } from "@/lib/reader/store";
import type { TermId } from "@/lib/terms";

const CARD_WIDTH = 300;
const GUTTER = 12;

type Place = { top?: number; bottom?: number; left: number; width: number; inPanel?: boolean };

/** Where the card goes for a term at `r`: below it, or above when the space below is short. */
function placeFor(r: DOMRect, rtl: boolean): Place {
  const width = Math.min(CARD_WIDTH, window.innerWidth - 2 * GUTTER);
  const anchor = rtl ? r.right - width : r.left;
  const left = Math.max(GUTTER, Math.min(anchor, window.innerWidth - width - GUTTER));
  const below = window.innerHeight - r.bottom > 240 || r.top < 240;
  return below ? { top: r.bottom + 6, left, width } : { bottom: window.innerHeight - r.top + 6, left, width };
}

/**
 * A technical term with a plain-language card (handoff §3.6). With "Explain terms" on (the default) the
 * term is dotted and opens a card on tap; Esc, a tap elsewhere, or scrolling the term off screen closes it. The card is dark in
 * both themes so it reads as an aside, and flips above the term when there is no room below.
 */
/** What a term card's jump does, by section (RDR-279). */
const JUMP_LABEL: Record<SectionId, { ar: string; en: string }> = {
  senses: { ar: "أرني المعاني", en: "Show the meanings" },
  family: { ar: "أرني الأسرة", en: "Show the family" },
  patterns: { ar: "أرني الأوزان", en: "Show me the shapes" },
  lexica: { ar: "أرني المعاجم", en: "Show the dictionaries" },
  timeline: { ar: "أين ظهرت", en: "Show where it appears" },
  usage: { ar: "أرني مواضعها", en: "Show its places" },
};

export function Term({ id, children }: { id: TermId; children: React.ReactNode }) {
  const locale = useLocale() === "ar" ? "ar" : "en";
  const client = useIsClient();
  const explain = useReaderPrefs((s) => s.explainTerms);
  const setPrefs = useReaderPrefs((s) => s.set);
  const jumpTo = useReader((s) => s.jumpTo);
  const glossary = useGlossary();
  const [place, setPlace] = useState<Place | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const cardId = useId();
  const open = place !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPlace(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!card.current?.contains(t) && !button.current?.contains(t)) close();
    };
    // Scroll events arrive a frame late (a tap that scrolled the term into view would close its own card),
    // so the card follows its term and closes only when the term leaves the screen.
    const follow = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) close();
      else setPlace((p) => (p ? { ...placeFor(r, document.documentElement.dir === "rtl"), inPanel: p.inPanel } : p));
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", follow, { capture: true, passive: true });
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", follow, { capture: true });
      window.removeEventListener("resize", follow);
    };
  }, [open]);

  // The glossary is served by the API (one source for every screen and for editors, P2.6).
  const term = glossary.data?.terms.find((x) => x.key === id);
  // Server render and the first client render show plain text; the stored preference decides afterwards.
  if (!client || !explain || !term) return <>{children}</>;
  const text = { name: locale === "ar" ? term.label_ar : term.label_en, body: locale === "ar" ? term.body_ar : term.body_en };
  const kind = locale === "ar" ? term.category_ar : term.category_en;
  // A jump opens the entry's section it names — only inside the reader's panel, where that section is.
  const jump = place?.inPanel && term.jump_target ? (term.jump_target as SectionId) : null;

  function toggle() {
    const b = button.current!;
    setPlace(open ? null : { ...placeFor(b.getBoundingClientRect(), locale === "ar"), inPanel: !!b.closest(".reader-panel, .reader-sheet") });
  }

  return (
    <>
      <button ref={button} type="button" className="term" aria-expanded={open} aria-controls={open ? cardId : undefined} onClick={toggle}>
        {children}
      </button>
      {place &&
        // portalled to the body: above the header and the onboarding card, never inside the sheet's stacking context (RDR-012)
        createPortal(
        <div
          ref={card}
          id={cardId}
          role="dialog"
          aria-label={text.name}
          className="term-card"
          style={{ position: "fixed", ...place }}
          dir={locale === "ar" ? "rtl" : "ltr"}
          lang={locale}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="term-card-kind">{kind}</p>
              <p className="term-card-name">{text.name}</p>
            </div>
            <button type="button" className="term-card-x" aria-label={locale === "ar" ? "إغلاق" : "Close"} onClick={() => { setPlace(null); button.current?.focus(); }}>
              ✕
            </button>
          </div>
          <p className="term-card-body">{text.body}</p>
          <div className="term-card-actions">
            {jump && (
              <button type="button" className="term-card-pill is-jump" onClick={() => { setPlace(null); jumpTo(jump); }}>
                {JUMP_LABEL[jump][locale]}
              </button>
            )}
            {term.href && (
              <Link href={term.href} className="term-card-pill" onClick={() => setPlace(null)}>
                {locale === "ar" ? "اقرأ المزيد" : "Read more"}
              </Link>
            )}
            <button type="button" className="term-card-pill" onClick={() => { setPlace(null); setPrefs({ explainTerms: false }); }}>
              {locale === "ar" ? "أوقف شرح المصطلحات" : "Stop explaining terms"}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
