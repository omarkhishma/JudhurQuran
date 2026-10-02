"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { useReader } from "@/lib/reader/store";

const LETTERS = "ء ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي".split(" ");
type RootRow = { key: string; spaced: string; translit: string; occurrences: number; lemma_count: number };

/** The index (design 03 §3.1 `lookup`, RDR-195 + spec "A–Z / root index"): roots by first letter in the
 * dictionary order, each opening its lemmas. */
export function IndexBody() {
  const t = useTranslations("rd");
  const locale = useLocale();
  const [letter, setLetter] = useState("ع");
  const [open, setOpen] = useState<string | null>(null);
  const roots = useQuery({ queryKey: ["roots-letter", letter], queryFn: () => getJSON<{ data: RootRow[] }>(`/roots?l1=${encodeURIComponent(letter)}&order=alphabetical&limit=500`) });
  return (
    <div className="flex flex-col gap-3 p-3.5">
      <div className="flex flex-wrap gap-1" role="group" aria-label={t("firstLetter")} dir="rtl">
        {LETTERS.map((l) => (
          <button key={l} type="button" className={"letter-btn" + (l === letter ? " is-on" : "")} aria-pressed={l === letter} onClick={() => setLetter(l)} lang="ar">
            {l}
          </button>
        ))}
      </div>
      <ul className="flex flex-col">
        {(roots.data?.data ?? []).map((r) => (
          <li key={r.key} className="border-b border-line">
            <button type="button" className="index-root" aria-expanded={open === r.key} onClick={() => setOpen(open === r.key ? null : r.key)}>
              <span className="ar-classical text-[18px] tracking-[.06em] text-root" lang="ar">{r.spaced}</span>
              <span className="mono text-[11px] text-t3" dir="ltr">{r.translit}</span>
              <span className="flex-1" />
              <span className="text-[11.5px] text-t3">{t("entriesN", { n: formatNumber(r.lemma_count, locale) })}</span>
            </button>
            {open === r.key && <RootLemmasList root={r.key} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RootLemmasList({ root }: { root: string }) {
  const locale = useLocale();
  const openWord = useReader((s) => s.openWord);
  const q = useQuery({ queryKey: ["root-family", root], queryFn: () => getJSON<{ family: { members: { slug: string; ar: { full: string }; pos: { ar: string | null; en: string | null }; occurrences: number }[] }[] }>(`/roots/${encodeURIComponent(root)}/family`) });
  const members = q.data?.family.flatMap((g) => g.members) ?? [];
  return (
    <ul className="flex flex-col pb-2">
      {members.map((m) => (
        <li key={m.slug}>
          <button type="button" className="index-lemma" onClick={() => openWord({ slug: m.slug, at: null })}>
            <span className="ar-classical min-w-[92px] text-[19px] leading-[1.6]" lang="ar" dir="rtl">{m.ar.full}</span>
            <span className="text-[12px] text-t3">{locale === "ar" ? m.pos.ar : m.pos.en}</span>
            <span className="flex-1" />
            <span className="mono text-[11px] text-t3">{formatNumber(m.occurrences, locale)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
