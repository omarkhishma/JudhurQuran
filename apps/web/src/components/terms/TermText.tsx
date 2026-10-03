"use client";

import { useLocale } from "next-intl";
import { useGlossary } from "@/lib/reader/api";
import { splitTerms } from "@/lib/termDetect";
import type { TermId } from "@/lib/terms";
import { Term } from "./Term";

/** Running text with every glossary term in it dotted (RDR-273/563) — for editorial prose such as a
 * pattern's function, where terms are not marked by hand. */
export function TermText({ text }: { text: string }) {
  const locale = useLocale();
  const glossary = useGlossary();
  const labels = (glossary.data?.terms ?? []).map((t) => ({ key: t.key, label: locale === "ar" ? t.label_ar : t.label_en }));
  return (
    <>
      {splitTerms(text, labels).map((r, i) =>
        r.term ? (
          <Term key={i} id={r.term as TermId}>
            {r.text}
          </Term>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  );
}
