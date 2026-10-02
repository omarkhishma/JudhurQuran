"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/Icon";
import { Term } from "@/components/terms/Term";
import { getJSON } from "@/lib/reader/api";
import { useReader } from "@/lib/reader/store";
import type { Features } from "@/lib/reader/types";
import type { WordDetail } from "@/lib/types";
import { ListenOccurrence } from "./Listen";
import { GrammarHere } from "./sections/Meanings";

/**
 * The entry for a word that has no lemma in the corpus — a free-standing pronoun (هُوَ) or the Quranic
 * initials (الٓمٓ) — so every word of the muṣḥaf opens something (RDR-548, RDR-547): its form here, its
 * segments, its grammar, what the gharīb works say about it, and the way into the verse's tafsir. No
 * root is invented for it (law: "no root", never a pseudo-root).
 */
export function LocationEntry({ at }: { at: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const openVerse = useReader((s) => s.openVerse);
  const q = useQuery({ queryKey: ["location", at], queryFn: () => getJSON<WordDetail>(`/words/${at}`), staleTime: Infinity });
  if (q.isError) return <p className="p-4 text-[13px] text-bad">{t("loadFailed")}</p>;
  const w = q.data;
  if (!w) return <div className="m-4 h-32 animate-pulse rounded-xl bg-card-2" role="status" aria-label={t("loading")} />;
  const f = w.features as unknown as Features;
  const pos = f.pos;
  const initials = w.pos === "INL";
  return (
    <article className="flex flex-col gap-3 p-3.5" aria-label={w.text_uthmani}>
      <header className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <h2 className="quran text-[40px] leading-[1.6] text-t1" lang="ar" dir="rtl">{w.text_uthmani}</h2>
          <span className="flex-1" />
          <ListenOccurrence location={w.location} tokenFrom={w.token_from} tokenTo={w.token_to} />
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-t2">
          {w.translit && <span className="mono" dir="ltr" lang="en">{w.translit}</span>}
          {pos && <span className="type-chip" style={{ ["--chip" as string]: "var(--c-word)" }}>{locale === "ar" ? pos.ar : pos.en}</span>}
        </p>
        <p className="text-[12px] text-t3">{t("thisOccurrence", { ref: w.verse.key, surah: w.verse.surah_name_ar })}</p>
        {w.gloss_en && (
          <p className="text-[13px] italic text-t2" lang="en" dir="ltr">
            {w.gloss_en} <span className="not-italic text-t3">— {t("corpusGlossCredit")}</span>
          </p>
        )}
        <p className="text-[13px] leading-relaxed text-t2">
          <Term id="noRoot">{t("noRoot")}</Term> — {initials ? t("initialsExplain") : t("noRootExplain")}
        </p>
      </header>
      {w.glosses.length > 0 && (
        <section className="layer">
          <div className="layer-head"><span className="text-[13.5px] font-medium">{t("sourcedLines")}</span></div>
          <div className="layer-body">
            {w.glosses.map((g) => (
              <div key={g.id} className="flex flex-col gap-1">
                <p className="ar-classical text-[15px] leading-[1.95] text-t1" lang="ar" dir="rtl">{g.gloss}</p>
                <p className="text-[11px] text-t3">{locale === "ar" ? g.attribution_ar : g.attribution_en}{g.page_ref ? ` · ${g.page_ref}` : ""}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <GrammarHere features={f} surface={w.text_uthmani} verseKey={w.verse.key} />
      <button type="button" className="btn self-start" onClick={() => openVerse(w.verse.key)}>
        <Icon name="tafsir" size={13} />
        {t("verseTafsirOf", { ref: w.verse.key })}
      </button>
    </article>
  );
}
