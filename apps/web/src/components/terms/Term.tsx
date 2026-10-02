"use client";

import { useLocale } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { usePrefs } from "@/lib/reader/store";
import { CATEGORY, TERMS, type TermId } from "@/lib/terms";

const CARD_WIDTH = 300;
const GUTTER = 12;

type Place = { top?: number; bottom?: number; left: number; width: number };

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
export function Term({ id, children }: { id: TermId; children: React.ReactNode }) {
  const locale = useLocale() === "ar" ? "ar" : "en";
  const client = useIsClient();
  const explain = usePrefs((s) => s.explainTerms);
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
      else setPlace(placeFor(r, document.documentElement.dir === "rtl"));
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

  const term = TERMS[id];
  // Server render and the first client render show plain text; the stored preference decides afterwards.
  if (!client || !explain || !term) return <>{children}</>;
  const text = term[locale];

  function toggle() {
    setPlace(open ? null : placeFor(button.current!.getBoundingClientRect(), locale === "ar"));
  }

  return (
    <>
      <button ref={button} type="button" className="term" aria-expanded={open} aria-controls={open ? cardId : undefined} onClick={toggle}>
        {children}
      </button>
      {place && (
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
          <p className="term-card-kind">{CATEGORY[term.category][locale]}</p>
          <p className="term-card-name">{text.name}</p>
          <p className="term-card-body">{text.body}</p>
          {term.href && (
            <Link href={term.href} className="term-card-more" onClick={() => setPlace(null)}>
              {locale === "ar" ? "اقرأ المزيد" : "Read more"}
            </Link>
          )}
        </div>
      )}
    </>
  );
}
