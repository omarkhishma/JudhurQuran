"use client";

import { useTranslations } from "next-intl";
import { setContrast, setSpacing, useContrast, useSpacing } from "@/lib/display";

/** More contrast and wider spacing (B9): two choices for every page, kept in this browser. */
export function DisplayPrefs() {
  const t = useTranslations("common");
  const contrast = useContrast();
  const spacing = useSpacing();
  return (
    <>
      <div className="flex flex-col gap-1.5 px-1.5 py-1">
        <p className="text-[13px] text-t1" id="contrast-label">{t("contrast")}</p>
        <div className="seg-group self-start" role="group" aria-labelledby="contrast-label">
          <button type="button" className="seg" aria-pressed={contrast === "auto"} onClick={() => setContrast("auto")}>{t("contrastAuto")}</button>
          <button type="button" className="seg" aria-pressed={contrast === "more"} onClick={() => setContrast("more")}>{t("contrastMore")}</button>
        </div>
        <p className="text-[11.5px] leading-[1.35] text-t3">{t("contrastHint")}</p>
      </div>
      <div className="flex flex-col gap-1.5 px-1.5 py-1">
        <p className="text-[13px] text-t1" id="spacing-label">{t("spacing")}</p>
        <div className="seg-group self-start" role="group" aria-labelledby="spacing-label">
          <button type="button" className="seg" aria-pressed={spacing === "normal"} onClick={() => setSpacing("normal")}>{t("spacingNormal")}</button>
          <button type="button" className="seg" aria-pressed={spacing === "wide"} onClick={() => setSpacing("wide")}>{t("spacingWide")}</button>
        </div>
        <p className="text-[11.5px] leading-[1.35] text-t3">{t("spacingHint")}</p>
      </div>
    </>
  );
}
