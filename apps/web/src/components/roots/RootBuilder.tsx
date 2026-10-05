"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cnt, formatNumber } from "@/lib/format";
import type { RootSummary } from "@/lib/types";
import { getJSON } from "@/lib/reader/api";

const FOLD: Record<string, string> = { "ا": "ء", "أ": "ء", "إ": "ء", "آ": "ء", "ؤ": "ء", "ئ": "ء", "ى": "ي", "ة": "ت" };

function normLetter(raw: string): string {
  const ch = raw.replace(/[ً-ٰٟ\s]/g, "").slice(-1);
  return FOLD[ch] ?? ch;
}

/** Three (optionally four) single-letter boxes; typing advances, Backspace on an empty box goes back. */
export function RootBuilder() {
  const t = useTranslations("roots");
  const locale = useLocale();
  const [letters, setLetters] = useState(["", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const active = letters.some(Boolean);
  const params = letters.map((l, i) => (l ? `l${i + 1}=${encodeURIComponent(l)}` : "")).filter(Boolean).join("&");
  const { data } = useQuery({
    queryKey: ["root-builder", params],
    enabled: active,
    queryFn: async () => await getJSON<{ data: RootSummary[]; total: number }>(`/roots?${params}&limit=120`),
  });

  function set(i: number, raw: string) {
    const v = normLetter(raw);
    const next = [...letters];
    next[i] = v;
    setLetters(next);
    if (v && i < 3) refs.current[i + 1]?.focus();
  }

  return (
    <section className="card p-4 md:p-5" aria-labelledby="builder-title">
      <h2 id="builder-title" className="text-[16px] font-semibold">{t("builderTitle")}</h2>
      <p className="mt-0.5 text-[13px] text-t3">{t("builderHint")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2" dir="rtl">
        {letters.map((l, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={l === "ء" ? "أ" : l}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !letters[i] && i > 0) refs.current[i - 1]?.focus();
            }}
            aria-label={t("letter", { n: formatNumber(i + 1, locale) })}
            maxLength={2}
            lang="ar"
            className={
              "ar-classical h-14 w-14 rounded-xl border bg-card text-center text-[28px] text-root outline-none focus:border-ring " +
              (i === 3 ? "border-dashed border-line-2" : "border-line-2")
            }
            inputMode="text"
            autoComplete="off"
          />
        ))}
        {active && (
          <button type="button" className="btn ms-2" onClick={() => setLetters(["", "", "", ""])}>
            {t("clear")}
          </button>
        )}
      </div>
      {active && data && (
        <div className="mt-4">
          <p className="mb-2 text-[13px] text-t2" aria-live="polite">{t("builderResults", cnt(data.total, locale))}</p>
          <ul className="flex flex-wrap gap-2">
            {data.data.map((r) => (
              <li key={r.key}>
                <Link
                  href={`/roots/${encodeURIComponent(r.key)}`}
                  prefetch={false}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line bg-card px-3 hover:border-root"
                >
                  <span className="ar-classical text-[20px] text-root" lang="ar">{r.spaced}</span>
                  <span className="mono text-[11.5px] text-t3">{formatNumber(r.occurrences, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
