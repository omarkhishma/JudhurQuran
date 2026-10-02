"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePersonal, useReader } from "@/lib/reader/store";
import type { WordPayload } from "@/lib/reader/types";

/** Where next? (design 03 §3.8, RDR-326…332): three deterministic doors from the server — a cousin,
 * a verse, the shape — closing every entry. */
export function WhereNext({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const openWord = useReader((s) => s.openWord);
  const jumpTo = useReader((s) => s.jumpTo);
  const trail = usePersonal((s) => s.trail);
  const distinct = new Set(trail.map((s) => s.id));
  return (
    <section className="flex flex-col gap-2 pt-1" aria-label={t("whereNext")}>
      <div className="flex items-center gap-2">
        <p className="label-caps">{t("whereNext")}</p>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11.5px] text-t3">{t("trailMeta", { n: distinct.size })}</span>
      </div>
      <div className="doors">
        {w.next_steps.map((s) => {
          if (s.kind === "cousin")
            return (
              <button key="cousin" type="button" className="door" style={{ ["--door" as string]: "var(--c-word)" }} onClick={() => openWord({ slug: s.slug, at: null })}>
                <span className="door-cap">{t("doorCousin")}</span>
                <span className="ar-classical text-[19px]" lang="ar" dir="rtl">{s.ar.full}</span>
                <span className="text-[11.5px] text-t2">{t("doorCousinWhy")}</span>
              </button>
            );
          if (s.kind === "verse")
            return (
              <a key="verse" className="door" style={{ ["--door" as string]: "var(--c-sentence)" }} href={`${locale === "en" ? "/en" : ""}/quran/${s.verse_key.split(":")[0]}?w=${encodeURIComponent(w.slug)}&at=${s.location}#v${s.verse_key.split(":")[1]}`}>
                <span className="door-cap">{t("doorVerse")}</span>
                <span className="mono text-[15px]" dir="ltr">{s.verse_key}</span>
                <span className="text-[11.5px] text-t2">{t("doorVerseWhy")}</span>
              </a>
            );
          return (
            <button key="pattern" type="button" className="door" style={{ ["--door" as string]: "var(--c-form)" }} onClick={() => jumpTo("patterns")}>
              <span className="door-cap">{t("doorShape")}</span>
              <span className="ar-classical text-[19px]" lang="ar">{s.ar.full}</span>
              <span className="text-[11.5px] text-t2">{t("doorShapeWhy")}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
