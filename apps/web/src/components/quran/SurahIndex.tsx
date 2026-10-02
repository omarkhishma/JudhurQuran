"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { Surah } from "@/lib/types";
import { cnt, formatNumber } from "@/lib/format";

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
  const shown = useMemo(() => {
    const k = simplify(q);
    if (!k) return surahs;
    const n = Number(q.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
    return surahs.filter(
      (s) =>
        (Number.isInteger(n) && n === s.number) ||
        simplify(s.name_ar).includes(k) ||
        simplify(s.name_translit).includes(k) ||
        simplify(s.name_en).includes(k),
    );
  }, [q, surahs]);

  return (
    <>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("filterPlaceholder")}
        aria-label={t("filterPlaceholder")}
        className="mb-5 h-11 w-full max-w-[420px] rounded-xl border border-line bg-card px-4 text-[15px] outline-none placeholder:text-t3 focus:border-ring"
      />
      {shown.length === 0 && <p className="text-t2">{t("noMatch")}</p>}
      <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s) => (
          <li key={s.number}>
            <Link
              href={`/quran/${s.number}`}
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
                  {s.revelation_place === "meccan" ? t("meccan") : t("medinan")} · {t("versesCount", cnt(s.verse_count, locale))}
                </span>
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
