"use client";

import { useTranslations } from "next-intl";
import { type Digits, setDigits, useDigits } from "@/lib/digits";

/** The digits preference (SHL-Q05): by the language, ١٢٣ or 123 everywhere. Each sample is drawn as written, never
 * in the chosen shapes (`.digits-raw`), so the choice reads true whatever is chosen. */
export function DigitsPref() {
  const t = useTranslations("common");
  const now = useDigits();
  const options: { v: Digits; label: string; title: string; raw?: boolean }[] = [
    { v: "auto", label: t("digitsAuto"), title: t("digitsAutoTitle") },
    { v: "arabic", label: "١٢٣", title: t("digitsArabicTitle"), raw: true },
    { v: "latin", label: "123", title: t("digitsLatinTitle"), raw: true },
  ];
  return (
    <div className="flex flex-col gap-1.5 px-1.5 py-1">
      <p className="text-[13px] text-t1" id="digits-label">{t("digits")}</p>
      <div className="seg-group self-start" role="group" aria-labelledby="digits-label">
        {options.map((o) => (
          <button key={o.v} type="button" className={"seg" + (o.raw ? " digits-raw" : "")} aria-pressed={now === o.v} onClick={() => setDigits(o.v)} title={o.title} aria-label={o.title}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-[11.5px] leading-[1.35] text-t3">{t("digitsHint")}</p>
    </div>
  );
}
