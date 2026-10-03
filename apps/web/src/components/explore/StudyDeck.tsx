"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ListenOccurrence } from "@/components/reader5/Listen";
import { Dialog } from "@/components/ui/Dialog";
import { Link } from "@/i18n/navigation";
import type { SetItem } from "@/lib/collections";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { usePersonal } from "@/lib/reader/store";
import type { WordPayload } from "@/lib/reader/types";
import { useSaved } from "@/lib/store/saved";

const SWIPE = 80;

/**
 * The study deck over a set (06 §6.2, COL-39…44; the prototype has none, so it is built from the spec): the
 * word on the front with its recitation where a recording exists (never synthesised speech, COL-44); a tap or
 * Space turns it to what it is; swipe, ← or → to Skip or Keep. Keep marks the word "learning" and stars it,
 * which brings its root family into the review deck (COL-42). An end card counts and leads to the review.
 */
export function StudyDeck({ title, items, onClose }: { title: string; items: SetItem[]; onClose: () => void }) {
  const t = useTranslations("explore");
  const locale = useLocale();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [kept, setKept] = useState(0);
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const setWordState = usePersonal((s) => s.setWordState);
  const bookmarks = useSaved((s) => s.bookmarks);
  const toggleBookmark = useSaved((s) => s.toggleBookmark);
  const done = i >= items.length;
  const x = items[Math.min(i, items.length - 1)];
  // the word at its first place: its recording there and the verse around it
  const word = useQuery({
    queryKey: ["word", x.slug, x.first?.location ?? null],
    queryFn: () => getJSON<WordPayload>(`/words/${encodeURIComponent(x.slug)}?limit=0${x.first ? `&at=${x.first.location}` : ""}`),
    enabled: !done,
    staleTime: Infinity,
  });

  function answer(keep: boolean) {
    if (done) return;
    if (keep) {
      setWordState(x.slug, "learning");
      if (!bookmarks.some((b) => b.kind === "lemma" && b.key === x.slug)) toggleBookmark({ kind: "lemma", key: x.slug, label: x.ar.full });
      setKept((k) => k + 1);
    }
    setFlipped(false);
    setDx(0);
    setI((n) => n + 1);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, button, a")) {
        if (e.key === " ") return; // Space on a focused control is that control's
      }
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowLeft") answer(false);
      else if (e.key === "ArrowRight") answer(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const occ = word.data?.occurrence;
  return (
    <Dialog open onClose={onClose} label={t("deck", { title })} width={520}>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold">{t("deck", { title })}</h2>
          <span className="flex-1" />
          {!done && <span className="mono text-[12px] text-t3">{t("deckOf", { n: formatNumber(i + 1, locale), of: formatNumber(items.length, locale) })}</span>}
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t("deckClose")}>✕</button>
        </div>
        {done ? (
          <div className="deck-card is-end" role="status">
            <p className="text-[17px] font-semibold">{t("deckDone")}</p>
            <p className="text-[13.5px] leading-relaxed text-t2">{t("deckSummary", { kept: formatNumber(kept, locale), skipped: formatNumber(items.length - kept, locale) })}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/read?mode=review" className="btn btn-primary">{t("deckReview")}</Link>
              <button type="button" className="btn" onClick={() => { setI(0); setKept(0); setFlipped(false); }}>{t("deckAgain")}</button>
              <button type="button" className="btn" onClick={onClose}>{t("deckClose")}</button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={"deck-card" + (flipped ? " is-back" : "")}
              // focus starts on the card, so Space turns it rather than pressing the close button
              data-autofocus
              aria-label={t("flip")}
              aria-pressed={flipped}
              onClick={() => Math.abs(dx) < 8 && setFlipped((f) => !f)}
              onPointerDown={(e) => (start.current = e.clientX)}
              onPointerMove={(e) => start.current != null && setDx(e.clientX - start.current)}
              onPointerUp={() => {
                const d = dx;
                start.current = null;
                if (d > SWIPE) answer(true);
                else if (d < -SWIPE) answer(false);
                else setDx(0);
              }}
              onPointerCancel={() => { start.current = null; setDx(0); }}
              style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 30}deg)` : undefined }}
            >
              {!flipped ? (
                <span className="flex flex-col items-center gap-2">
                  <span className="ar-classical text-[44px] leading-[1.4]" lang="ar" dir="rtl">{x.ar.full}</span>
                  <span className="text-[12px] text-t3">{t("flipHint")}</span>
                </span>
              ) : (
                <span className="flex flex-col items-center gap-1.5 text-center">
                  <span className="ar-classical text-[30px]" lang="ar" dir="rtl">{x.ar.full}</span>
                  <span className="text-[13px] text-t2" dir="ltr" lang="en">{x.ar.translit}{locale !== "ar" && x.gloss_en ? ` — ${x.gloss_en}` : ""}</span>
                  <span className="text-[12.5px] text-t2">
                    {x.root ? <span className="ar-classical text-[17px] text-root" lang="ar">{x.root.spaced}</span> : t("noRoot")}
                    {x.pattern && <span className="ar-classical ms-2 text-[16px] text-form" lang="ar">{x.pattern.ar.full}</span>}
                  </span>
                  <span className="text-[12px] text-t3">{t("inQuran", cnt(x.occurrences, locale))}</span>
                  {occ && (
                    <span className="quran line-clamp-3 text-[17px] leading-[2]" lang="ar" dir="rtl">
                      {occ.verse_key ? `${verseRef(occ.verse_key, locale)} • ` : ""}
                      {occ.surface.full}
                    </span>
                  )}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <button type="button" className="btn min-h-[44px] flex-1" onClick={() => answer(false)}>{t("skip")}</button>
              {occ && x.first && <ListenOccurrence verseKey={x.first.verse_key} audio={occ.audio} />}
              <button type="button" className="btn btn-primary min-h-[44px] flex-1" onClick={() => answer(true)}>{t("keepCard")}</button>
            </div>
            <p className="text-center text-[11.5px] text-t3" dir="ltr">{t("deckKeys")}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
