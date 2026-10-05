"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { colourVar } from "@/lib/collections";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { colourOf, kindOf, type SetRule } from "@/lib/sets";

/** A rule said in the reader's language: what it gathers, where, in what order. */
export function useRuleSummary() {
  const t = useTranslations("explore");
  const locale = useLocale();
  const surahs = useQuery({ queryKey: ["surahs"], queryFn: () => getJSON<{ data: { number: number; name_ar: string; name_translit: string }[] }>("/surahs"), staleTime: Infinity });
  const patterns = useQuery({ queryKey: ["patterns"], queryFn: async () => (await getJSON<{ data: { slug: string; ar: { full: string } }[] }>("/patterns")).data, staleTime: Infinity });
  return (rule: SetRule) => {
    const kind = kindOf(rule);
    const sep = locale === "ar" ? "، " : ", ";
    const what =
      kind === "root"
        ? t("ruleSummary.root", { roots: (rule.root ?? []).map((k) => [...k].join(" ")).join(sep) })
        : kind === "patterns"
          ? t("ruleSummary.patterns", { patterns: (rule.patterns ?? []).map((s) => patterns.data?.find((p) => p.slug === s)?.ar.full ?? s).join(sep) })
          : t(`ruleSummary.${kind}`);
    const s = rule.surah ? surahs.data?.data.find((x) => x.number === rule.surah) : null;
    const where = rule.surah ? ` ${t("inSurah", { name: s ? (locale === "ar" ? s.name_ar : s.name_translit) : formatNumber(rule.surah, locale) })}` : "";
    return `${what}${where}${sep}${t("mostFrequentFirst")}`;
  };
}

/** A set someone made, as a card: its name, where it comes from, and its rule in words (B29). */
export function MadeSetCard({ href, title, line, rule, from }: { href: string; title: string; line: string; rule: SetRule; from?: string }) {
  return (
    <Link href={href} className="set-card" style={{ borderTopColor: colourVar(colourOf(rule)) }}>
      <span className="text-[15px] font-semibold" dir="auto">{title}</span>
      {from && <span className="text-[11.5px] text-t3" dir="auto">{from}</span>}
      <span className="text-[12.5px] text-t2">{line}</span>
    </Link>
  );
}

