"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import type { Verse } from "@/lib/types";
import { VerseLayer } from "./VerseKnowledge";

export type MushafSign = { id: string; kind: "waqf" | "sakt" | "sajda" | "hizb"; chars: string; label_ar: string; text_ar: string; page: string };
type Signs = { data: MushafSign[]; source: { attribution_ar: string; attribution_en: string } };

function useMushafSigns() {
  return useQuery({ queryKey: ["mushaf-signs"], queryFn: () => getJSON<Signs>("/mushaf-signs"), staleTime: Infinity });
}

/** One sign: its letter as the mushaf's note names it (never the bare combining mark), and the note's words. */
function SignLine({ s, lead, credit }: { s: MushafSign; lead?: string; credit: string }) {
  const t = useTranslations("rd");
  return (
    <li className="sign-line" data-sign={s.id}>
      {lead && <span className="text-[11.5px] text-t3">{lead} </span>}
      <span className="sign-label ar-classical" lang="ar">{s.label_ar}</span>{" "}
      <span className="text-[13px] leading-[1.9] text-t1" lang="ar" dir="rtl">{s.text_ar}</span>
      <span className="block text-[11px] text-t3">— {credit}، {t("signPage", { page: s.page })}</span>
    </li>
  );
}

/**
 * The signs written on a word (P3.9): what each means, in the Madinah Mushaf's own note «التعريف بهذا
 * المصحف», credited. The signs stay furniture in the text (RDR-547); their meaning is read here.
 */
export function WordSigns({ ids }: { ids: string[] }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const q = useMushafSigns();
  if (!ids.length || !q.data) return null;
  const credit = locale === "ar" ? q.data.source.attribution_ar : q.data.source.attribution_en;
  const signs = ids.map((id) => q.data.data.find((s) => s.id === id)).filter((s): s is MushafSign => !!s);
  return (
    <section className="word-signs mt-1.5" aria-label={t("signOnWord")}>
      <p className="label-caps">{t("signOnWord")}</p>
      <ul className="flex flex-col gap-1">
        {signs.map((s) => (
          <SignLine key={s.id} s={s} credit={credit} />
        ))}
      </ul>
    </section>
  );
}

/** Every sign in a verse, each after the word it is written on; the ḥizb sign at its start. */
export function VerseSigns({ verseKey }: { verseKey: string }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const q = useMushafSigns();
  const v = useQuery({ queryKey: ["verse", verseKey], queryFn: () => getJSON<Verse>(`/verses/${verseKey}`), staleTime: Infinity });
  if (!q.data || !v.data) return null;
  const credit = locale === "ar" ? q.data.source.attribution_ar : q.data.source.attribution_en;
  const items: { key: string; s: MushafSign; lead: string }[] = [];
  const hizb = q.data.data.find((s) => s.kind === "hizb");
  if (v.data.hizb_mark && hizb) items.push({ key: "hizb", s: hizb, lead: t("signAtStart") });
  for (const tk of v.data.tokens) {
    for (const s of q.data.data) {
      if (s.kind !== "hizb" && [...s.chars].some((c) => tk.text.endsWith(c))) items.push({ key: `${tk.position}-${s.id}`, s, lead: t("signAfter", { word: tk.text }) });
    }
  }
  if (!items.length) return null;
  return (
    <VerseLayer title={t("signsTitle")} meta={formatNumber(items.length, locale)} defaultOpen={false}>
      <ul className="verse-signs flex flex-col gap-2">
        {items.map((i) => (
          <SignLine key={i.key} s={i.s} lead={i.lead} credit={credit} />
        ))}
      </ul>
    </VerseLayer>
  );
}
