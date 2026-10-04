"use client";

import { useTranslations } from "next-intl";
import { useAfterMount } from "@/lib/client";
import { usePrefs } from "@/lib/reader/store";

/** The vowel marks shown or hidden on a text that is not the mushaf (D7): one preference for every such text. */
export function MarksToggle() {
  const t = useTranslations("common");
  const marks = usePrefs((s) => s.marks);
  const set = usePrefs((s) => s.set);
  const mounted = useAfterMount();
  const on = !mounted || marks;
  return (
    <button type="button" role="switch" aria-checked={on} className={"chip" + (on ? " is-on" : "")} onClick={() => set({ marks: !marks })} title={t("marksHint")}>
      {t("marks")}
    </button>
  );
}
