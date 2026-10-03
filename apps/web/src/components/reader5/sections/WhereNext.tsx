"use client";

import { useLocale, useTranslations } from "next-intl";
import { cnt } from "@/lib/format";
import { usePersonal, useReader } from "@/lib/reader/store";
import type { WordPayload } from "@/lib/reader/types";

/** Where next? (design 03 §3.8, RDR-326…332): three deterministic doors from the server — a cousin,
 * a verse, the shape — closing every entry. */
export function WhereNext({ w }: { w: WordPayload }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const openWord = useReader((s) => s.openWord);
  const openShapes = useReader((s) => s.openShapes);
  const trail = usePersonal((s) => s.trail);
  const distinct = new Set(trail.map((s) => `${s.kind}:${s.id}`));
  // The cousin door prefers a family member not yet on the trail, to avoid loops (RDR-588).
  const visited = new Set(trail.filter((s) => s.kind === "word").map((s) => s.id));
  const family = w.family.flatMap((g) => g.members).filter((m) => m.slug !== w.slug);
  const fresh = family.find((m) => !visited.has(m.slug));
  return (
    <section className="flex flex-col gap-2 pt-1" aria-label={t("whereNext")}>
      <div className="flex items-center gap-2">
        <p className="label-caps">{t("whereNext")}</p>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11.5px] text-t3">{t("trailMeta", cnt(distinct.size, locale))}</span>
      </div>
      <div className="doors">
        {w.next_steps.map((s) => {
          if (s.kind === "cousin") {
            const swap = visited.has(s.slug) && fresh;
            const c = swap ? { slug: fresh.slug, ar: fresh.ar, gloss_en: fresh.gloss_en } : s;
            // its own shape: the same as this word's, or named (RDR-329)
            const cp = swap ? (w.family.find((g) => g.members.some((m) => m.slug === fresh.slug))?.pattern ?? null) : s.pattern;
            const why = cp && w.pattern && cp.slug === w.pattern.slug ? t("doorCousinSame") : cp ? t("doorCousinShaped", { pattern: cp.ar.full }) : t("doorCousinWhy");
            return (
              <button key="cousin" type="button" className="door" style={{ ["--door" as string]: "var(--c-word)" }} onClick={() => openWord({ slug: c.slug, at: null })}>
                <span className="door-cap">{t("doorCousin")}</span>
                <span className="ar-classical text-[19px]" lang="ar" dir="rtl">{c.ar.full}</span>
                <span className="text-[11.5px] text-t2">
                  {c.gloss_en && locale !== "ar" ? `${c.gloss_en} — ` : ""}
                  {why}
                </span>
              </button>
            );
          }
          if (s.kind === "verse")
            return (
              <a key="verse" className="door" style={{ ["--door" as string]: "var(--c-sentence)" }} href={`${locale === "en" ? "/en" : ""}/quran/${s.verse_key.split(":")[0]}?w=${encodeURIComponent(w.slug)}&at=${s.location}#v${s.verse_key.split(":")[1]}`}>
                <span className="door-cap">{t("doorVerse")}</span>
                <span className="mono text-[15px]" dir="ltr">{s.verse_key}</span>
                <span className="text-[11.5px] text-t2">{t("doorVerseWhy")}</span>
              </a>
            );
          return (
            // Shapes opened on this pattern, with a few other words on it (RDR-332)
            <button key="pattern" type="button" className="door" style={{ ["--door" as string]: "var(--c-form)" }} onClick={() => openShapes(s.slug)}>
              <span className="door-cap">{t("doorShape")}</span>
              <span className="ar-classical text-[19px]" lang="ar">{s.ar.full}</span>
              <span className="text-[11.5px] text-t2">
                {w.shapes.same_pattern_other_roots.length
                  ? t("doorShapeMore", { ...cnt(w.shapes.same_pattern_other_roots.length, locale), words: w.shapes.same_pattern_other_roots.slice(0, 3).map((m) => m.ar.full).join("، ") })
                  : t("doorShapeWhy")}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
