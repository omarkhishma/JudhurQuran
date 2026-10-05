"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { Link } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { cnt, formatNumber } from "@/lib/format";
import { usePrefs } from "@/lib/reader/store";
import type { Surah } from "@/lib/types";

function simplify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ًͯ-ْٰـ'’ʿʾ\-\s]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/^(al|an|ash|at|as|ad|ar|az)/, "")
    .replace(/^ال/, "");
}

export function SurahIndex({ surahs }: { surahs: Surah[] }) {
  const t = useTranslations("surah");
  const locale = useLocale();
  const [q, setQ] = useState("");
  // the mushaf's order, or the traditional order of revelation (B6): the reader's choice, kept with their others
  const client = useIsClient();
  const stored = usePrefs((s) => s.order);
  const setPrefs = usePrefs((s) => s.set);
  const order = client ? stored : "mushaf";
  const ordered = useMemo(() => (order === "revelation" ? [...surahs].sort((a, b) => a.revelation_order - b.revelation_order) : surahs), [order, surahs]);
  const shown = useMemo(() => {
    const k = simplify(q);
    if (!k) return ordered;
    const n = Number(q.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
    return ordered.filter(
      (s) =>
        (Number.isInteger(n) && n === s.number) ||
        simplify(s.name_ar).includes(k) ||
        simplify(s.name_translit).includes(k) ||
        simplify(s.name_en).includes(k),
    );
  }, [q, ordered]);

  return (
    <>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("filterPlaceholder")}
        aria-label={t("filterPlaceholder")}
        className="mb-3 h-11 w-full max-w-[420px] rounded-xl border border-line bg-card px-4 text-[15px] outline-none placeholder:text-t3 focus:border-ring"
      />
      <div className="mb-5 flex flex-col gap-2">
        <Segmented
          label={t("orderLabel")}
          value={order}
          onChange={(o) => setPrefs({ order: o })}
          options={[
            { value: "mushaf", label: t("orderMushaf") },
            { value: "revelation", label: t("orderRevelation") },
          ]}
        />
        {order === "revelation" && <p className="max-w-[80ch] text-[13px] leading-relaxed text-t2">{t("orderNote")}</p>}
      </div>
      {shown.length === 0 && <p className="text-t2">{t("noMatch")}</p>}
      <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s) => (
          <li key={s.number}>
            <Link
              href={`/quran/${s.number}`}
              prefetch={false}
              className="card flex min-h-[72px] items-center gap-3 px-4 py-3 transition-colors hover:border-ring"
            >
              <span className="mono flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card-2 text-[13px] text-t2">
                {formatNumber(s.number, locale)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-t1" dir="ltr" lang="en">
                  {locale === "en" ? `${s.name_translit}` : s.name_translit}
                </span>
                <span className="block text-[12.5px] text-t3">
                  {s.revelation_place === "meccan" ? t("meccan") : t("medinan")} • {t("versesCount", cnt(s.verse_count, locale))}
                  {order === "revelation" && ` • ${t("revealedNth", { n: formatNumber(s.revelation_order, locale) })}`}
                </span>
                {order === "revelation" && !!s.place_notes && <span className="block text-[12px] text-t3">{t("placeNotes", cnt(s.place_notes, locale))}</span>}
              </span>
              <span className="ar-classical shrink-0 text-[22px] text-t1" dir="rtl" lang="ar">
                {s.name_ar}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
