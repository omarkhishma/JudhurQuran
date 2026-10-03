"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getJSON, useWordAt } from "@/lib/reader/api";
import { useReader } from "@/lib/reader/store";
import type { Features, WordPayload } from "@/lib/reader/types";
import { tags } from "./GrammarBand";
import { WordStateControl } from "./WordEntry";

export type HoverWord = { slug: string; at: string; rect: { top: number; bottom: number; left: number; right: number } };

const EDGE = 160; // the card's centre stays this far from either side of the window (RDR-583)
const GAP = 10;

/**
 * The hover card (design 03 §3.4, RDR-117…122): on a desktop with a mouse, a word's dictionary form, root,
 * meaning here and grammar, its study state when study mode is on, and the way into the full entry or the
 * graph. Above the word, or below it when there is no room above (the prototype clipped it, RDR-524); its
 * centre clamped to the window (RDR-583). The surface times its showing and hiding (RDR-122, 584).
 */
export function HoverCard({ word, onEnter, onLeave, onClose }: { word: HoverWord; onEnter: () => void; onLeave: () => void; onClose: () => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const openWord = useReader((s) => s.openWord);
  const setHandoff = useReader((s) => s.setHandoff);
  const box = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);
  const q = useQuery({
    queryKey: ["word-hover", word.slug, word.at],
    queryFn: () => getJSON<WordPayload>(`/words/${encodeURIComponent(word.slug)}?limit=0&at=${word.at}`),
    enabled: !!word.slug,
    staleTime: 10 * 60_000,
  });
  const byPlace = useWordAt(word.slug ? null : word.at);

  // room above the word? (measured once the card has its height)
  useLayoutEffect(() => {
    const h = box.current?.offsetHeight ?? 0;
    const header = document.querySelector(".reader-header")?.getBoundingClientRect().bottom ?? 0;
    setBelow(word.rect.top - GAP - h < header + 4);
  }, [word, q.data, byPlace.data]);

  const x = Math.min(Math.max((word.rect.left + word.rect.right) / 2, EDGE), window.innerWidth - EDGE);
  const style = below
    ? { left: x, top: word.rect.bottom + GAP, transform: "translate(-50%, 0)" }
    : { left: x, top: word.rect.top - GAP, transform: "translate(-50%, -100%)" };

  let body: React.ReactNode = <div className="h-16 animate-pulse rounded-lg bg-card-2" />;
  const w = q.data;
  const d = byPlace.data;
  if (w) {
    const occ = w.occurrence;
    const here = occ?.meanings_here[0];
    const meaning = locale === "ar" ? (here ? `${here.phrase_ar}: ${here.meaning_ar}` : occ?.glosses[0]?.gloss) : (occ?.gloss_en ?? w.gloss_en);
    body = (
      <>
        <div className="flex items-baseline gap-2">
          <span className="ar-classical text-[24px] leading-[1.4] text-t1" lang="ar" dir="rtl">{w.ar.full}</span>
          <span className="mono text-[11.5px] text-t3" dir="ltr" lang="en">{w.ar.translit}</span>
          <span className="flex-1" />
          {w.root ? (
            <span className="ar-classical text-[15px] tracking-[.06em] text-root" lang="ar">{w.root.ar_spaced}</span>
          ) : (
            <span className="text-[11.5px] text-t3">{t("noRoot")}</span>
          )}
        </div>
        {meaning && (
          <p className="text-[13px] leading-relaxed text-t1" lang={locale === "ar" && (here || occ?.glosses[0]) ? "ar" : "en"} dir="auto">{meaning}</p>
        )}
        {occ && <p className="text-[11.5px] text-t3">{tags(occ.features, locale).join(" · ")}</p>}
        <WordStateControl slug={w.slug} />
      </>
    );
  } else if (d) {
    const here = d.meanings_here[0];
    body = (
      <>
        <div className="flex items-baseline gap-2">
          <span className="quran text-[24px] leading-[1.5] text-t1" lang="ar" dir="rtl">{d.text_uthmani}</span>
          <span className="flex-1" />
          <span className="text-[11.5px] text-t3">{t("noRoot")}</span>
        </div>
        {(here || d.glosses[0]) && <p className="text-[13px] leading-relaxed text-t1" lang="ar" dir="rtl">{here ? `${here.phrase_ar}: ${here.meaning_ar}` : d.glosses[0].gloss}</p>}
        <p className="text-[11.5px] text-t3">{tags(d.features as unknown as Features, locale).join(" · ")}</p>
      </>
    );
  }

  return createPortal(
    <div
      ref={box}
      className={"hover-card popover" + (below ? " is-below" : "")}
      role="dialog"
      aria-label={t("hoverCardLabel")}
      style={style}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      {body}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn flex-1 text-[12px]"
          onClick={() => {
            openWord({ slug: word.slug, at: word.at });
            onClose();
          }}
        >
          {t("fullEntry")}
        </button>
        {word.slug && (
          <button
            type="button"
            className="btn flex-1 text-[12px]"
            onClick={() => {
              openWord({ slug: word.slug, at: word.at });
              setHandoff({ seed: "word", slug: word.slug, at: word.at });
              onClose();
            }}
          >
            {t("openInGraph")}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
