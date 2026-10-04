"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Switch } from "@/components/ui/Switch";
import { formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { usePrefs } from "@/lib/reader/store";

type Work = { id: string; title_ar: string; title_en: string; author_ar: string; author_en: string };
type Dict = { key: string; name_ar: string; name_en: string; author_ar: string; author_en: string; death_hijri: number | null; death_ce: number | null };

/** Reading preferences popover (design 03 §3.2, inventory RDR-032…059): the union of the spec's four
 * toggles and the prototype's eight (D21), plus the dictionaries shown. Esc, outside tap close it. */
export function ReadingPrefs({ onClose }: { onClose: (how?: "key" | "pointer") => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const p = usePrefs();
  const box = useRef<HTMLDivElement>(null);
  const dicts = useQuery({ queryKey: ["dictionaries"], queryFn: () => getJSON<{ data: Dict[] }>("/dictionaries"), staleTime: Infinity });
  const works = useQuery({ queryKey: ["works", "translation"], queryFn: () => getJSON<{ data: Work[] }>("/works?kind=translation"), staleTime: Infinity });

  useEffect(() => {
    box.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose("key");
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (!box.current?.contains(el) && !el.closest("[aria-expanded]")) onClose("pointer");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const isAr = locale === "ar";
  const translitOn = p.translitLine ?? !isAr;
  const translationOn = p.translationLine ?? !isAr;
  const list = dicts.data?.data ?? [];
  const shown = list.filter((d) => !p.dictOff[d.key]).length;

  return (
    <div ref={box} className="popover prefs-popover" role="dialog" aria-label={t("readingTitle")}>
      <p className="label-caps px-1.5 pb-1">{t("readingTitle")}</p>
      <Switch checked={translationOn} onChange={(v) => p.set({ translationLine: v })} label={t("prefTranslation")} hint={t("prefTranslationHint")} />
      {translationOn && (works.data?.data.length ?? 0) > 1 && (
        // which translation the line under each verse shows (RDR-557)
        <label className="prefs-select">
          <span>{t("prefTranslationWork")}</span>
          <select value={p.translation} onChange={(e) => p.set({ translation: e.target.value })}>
            {works.data!.data.map((w) => (
              <option key={w.id} value={w.id}>{isAr ? w.title_ar : w.title_en}</option>
            ))}
          </select>
        </label>
      )}
      {isAr && <Switch checked={p.muyassarLine} onChange={(v) => p.set({ muyassarLine: v })} label={t("prefMuyassar")} hint={t("prefMuyassarHint")} />}
      <Switch checked={p.imlaeiLine} onChange={(v) => p.set({ imlaeiLine: v })} label={t("prefImlaei")} hint={t("prefImlaeiHint")} />
      <Switch checked={p.marks} onChange={(v) => p.set({ marks: v })} label={t("prefMarks")} hint={t("prefMarksHint")} />
      <Switch checked={translitOn} onChange={(v) => p.set({ translitLine: v })} label={t("prefTranslit")} hint={t("prefTranslitHint")} />
      <Switch checked={p.tintRoot} onChange={(v) => p.set({ tintRoot: v })} label={t("prefTint")} hint={t("prefTintHint")} />
      <Switch checked={p.grammarBand} onChange={(v) => p.set({ grammarBand: v })} label={t("prefGrammar")} hint={t("prefGrammarHint")} />
      <Switch checked={p.wordStates} onChange={(v) => p.set({ wordStates: v })} label={t("prefStates")} hint={t("prefStatesHint")} />
      <Switch checked={p.panelTabs} onChange={(v) => p.set({ panelTabs: v })} label={t("prefTabs")} hint={t("prefTabsHint")} />
      <Switch checked={p.explainTerms} onChange={(v) => p.set({ explainTerms: v })} label={t("prefExplain")} hint={t("prefExplainHint")} />
      <Switch checked={p.dueSignal} onChange={(v) => p.set({ dueSignal: v })} label={t("prefDue")} hint={t("prefDueHint")} />
      <hr className="mx-1 my-1.5 border-line" />
      <div className="flex items-center justify-between px-1.5 pb-1">
        <p className="label-caps">{t("dictsShown")}</p>
        <span className="mono text-[11px] text-t3">{t("dictsCount", { on: formatNumber(shown, locale), all: formatNumber(list.length, locale) })}</span>
      </div>
      {list.map((d) => (
        <Switch
          key={d.key}
          checked={!p.dictOff[d.key]}
          onChange={(v) => {
            // only the switched-off dictionaries are kept (RDR-612)
            const next = { ...p.dictOff };
            if (v) delete next[d.key];
            else next[d.key] = true;
            p.set({ dictOff: next });
          }}
          label={isAr ? d.name_ar : d.name_en}
          hint={
            isAr
              ? `${d.author_ar}${d.death_hijri ? ` • ت ${formatNumber(d.death_hijri, locale)}هـ` : ""}${d.death_ce ? ` / ${formatNumber(d.death_ce, locale)}م` : ""}`
              : `${d.author_en}${d.death_ce ? ` • d. ${d.death_ce}` : ""}`
          }
        />
      ))}
    </div>
  );
}
