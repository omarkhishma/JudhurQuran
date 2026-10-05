"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { useSurahNames } from "@/components/classroom/shared";
import { Segmented } from "@/components/ui/Segmented";
import { cnt, formatNumber } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { evaluateSet, kindOf, LIMIT_MAX, parseRoots, RULE_KINDS, type RuleKind, type SetRule } from "@/lib/sets";
import { useDebounced } from "@/lib/useDebounced";

type PatternRow = { slug: string; ar: { full: string }; lemma_count: number; occurrences: number };

// the refusals a rule can meet, each said in the reader's language
const RULE_ERRORS = ["unknown_root", "unknown_pattern", "rule_roots", "rule_patterns", "rule_limit", "rule_surah"];
const pct = (x: number, locale: string) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent", maximumFractionDigits: 1 }).format(x);

/**
 * A set made by a rule (B29), for a reader's own sets and a teacher's for a class: a title, the kind of rule — roots,
 * patterns, the most frequent words, the function words, the words claimed as foreign — its values, a sūra or the
 * whole Quran, how many words; the words it yields shown as it is written, read from the data, so what is saved can
 * only hold what the rule gives.
 */
export function SetBuilder({ initial, onSave, onCancel, saveLabel }: { initial?: { title: string; rule: SetRule }; onSave: (title: string, rule: SetRule) => Promise<void> | void; onCancel: () => void; saveLabel?: string }) {
  const t = useTranslations("explore");
  const locale = useLocale();
  const names = useSurahNames();
  const ids = { title: useId(), roots: useId(), filter: useId(), surah: useId(), limit: useId() };
  const start = initial?.rule;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState<RuleKind>(start ? kindOf(start) : "root");
  const [roots, setRoots] = useState((start?.root ?? []).join("، "));
  const [patterns, setPatterns] = useState<string[]>(start?.patterns ?? []);
  const [filter, setFilter] = useState("");
  const [surah, setSurah] = useState<number | null>(start?.surah ?? null);
  const [limit, setLimit] = useState<number>(start?.limit ?? 20);
  const [saving, setSaving] = useState<"idle" | "saving" | "failed">("idle");
  const catalogue = useQuery({ queryKey: ["patterns"], queryFn: async () => (await getJSON<{ data: PatternRow[] }>("/patterns")).data, staleTime: Infinity, enabled: kind === "patterns" });

  const rule = useMemo((): SetRule | null => {
    const out: SetRule = {};
    if (kind === "root") {
      const keys = parseRoots(roots);
      if (!keys.length) return null;
      out.root = keys;
    } else if (kind === "patterns") {
      if (!patterns.length) return null;
      out.patterns = patterns;
    } else out[kind] = true;
    if (surah) out.surah = surah;
    if (limit) out.limit = Math.min(LIMIT_MAX, Math.max(1, limit));
    return out;
  }, [kind, roots, patterns, surah, limit]);
  const asked = useDebounced(rule, 350);
  const preview = useQuery({ queryKey: ["set-eval", asked], queryFn: () => evaluateSet(asked!), enabled: !!asked, retry: false, staleTime: 60_000 });
  const err = preview.error instanceof Error ? preview.error.message : null;

  const kinds = RULE_KINDS.map((k) => ({ value: k, label: t(`ruleKind.${k}`) }));
  const shownPatterns = (catalogue.data ?? []).filter((p) => !filter.trim() || p.ar.full.includes(filter.trim()) || p.slug.includes(filter.trim().toLowerCase()));
  const ready = !!rule && !!title.trim() && !!preview.data?.item_count && asked === rule;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !rule) return;
    setSaving("saving");
    try {
      await onSave(title.trim(), rule);
      setSaving("idle");
    } catch {
      setSaving("failed");
    }
  }

  return (
    <form className="set-builder flex flex-col gap-3 rounded-xl border border-line bg-card p-4" onSubmit={(e) => void save(e)}>
      <label className="flex flex-col gap-1 text-[13px]" htmlFor={ids.title}>
        {t("setTitle")}
        <input id={ids.title} className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required dir="auto" data-autofocus />
      </label>
      <div className="flex flex-col gap-1 text-[13px]">
        <span>{t("ruleFrom")}</span>
        <Segmented value={kind} options={kinds} onChange={setKind} label={t("ruleFrom")} />
        <p className="text-[12px] text-t3">{t(`ruleHint.${kind}`)}</p>
      </div>
      {kind === "root" && (
        <label className="flex flex-col gap-1 text-[13px]" htmlFor={ids.roots}>
          {t("rootsLabel")}
          <input id={ids.roots} className="field-input ar-classical text-[16px]" value={roots} onChange={(e) => setRoots(e.target.value)} placeholder="ع ل م، ك ت ب" lang="ar" dir="rtl" />
        </label>
      )}
      {kind === "patterns" && (
        <fieldset className="flex flex-col gap-1.5 text-[13px]">
          <legend className="mb-1">{t("patternsLabel", { n: formatNumber(patterns.length, locale) })}</legend>
          <input id={ids.filter} className="field-input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("patternsFilter")} aria-label={t("patternsFilter")} dir="auto" />
          <ul className="set-builder-patterns" aria-busy={catalogue.isLoading}>
            {shownPatterns.slice(0, 60).map((p) => {
              const on = patterns.includes(p.slug);
              return (
                <li key={p.slug}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={on} disabled={!on && patterns.length >= 10} onChange={() => setPatterns((xs) => (on ? xs.filter((x) => x !== p.slug) : [...xs, p.slug]))} />
                    <span className="ar-classical text-[17px]" lang="ar">{p.ar.full}</span>
                    <span className="text-[11.5px] text-t3">{t("inQuran", cnt(p.occurrences, locale))}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[13px]" htmlFor={ids.surah}>
          {t("surahLabel")}
          <select id={ids.surah} className="field-input" value={surah ?? ""} onChange={(e) => setSurah(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t("wholeQuran")}</option>
            {names && [...names].map(([n, name]) => (
              <option key={n} value={n}>{`${formatNumber(n, locale)}. ${name}`}</option>
            ))}
          </select>
        </label>
        <label className="flex w-[160px] flex-col gap-1 text-[13px]" htmlFor={ids.limit}>
          {t("limitLabel", { n: formatNumber(LIMIT_MAX, locale) })}
          <input id={ids.limit} type="number" inputMode="numeric" min={1} max={LIMIT_MAX} className="field-input" value={limit} onChange={(e) => setLimit(Number(e.target.value) || 0)} />
        </label>
      </div>
      <section className="flex flex-col gap-1.5 border-t border-line pt-3" aria-live="polite" aria-label={t("previewTitle")}>
        <p className="label-caps">{t("previewTitle")}</p>
        {!rule ? (
          <p className="text-[12.5px] text-t3">{t(`ruleHint.${kind}`)}</p>
        ) : err ? (
          <p className="text-[12.5px] text-bad" role="alert">{t(RULE_ERRORS.includes(err) ? `ruleError.${err}` : "ruleError.other")}</p>
        ) : !preview.data || asked !== rule ? (
          <div className="h-10 animate-pulse rounded-lg bg-card-2" />
        ) : preview.data.item_count === 0 ? (
          <p className="text-[12.5px] text-t3">{t("previewEmpty")}</p>
        ) : (
          <>
            <p className="text-[12.5px] text-t2">
              {t("previewCount", { words: t("words", cnt(preview.data.item_count, locale)), roots: t("roots", cnt(preview.data.root_count, locale)), pct: pct(preview.data.coverage, locale), scope: surah && names ? t("ofSurah", { name: names.get(surah) ?? "" }) : t("ofQuran") })}
            </p>
            <p className="ar-classical text-[18px] leading-relaxed text-t1" lang="ar" dir="rtl">{preview.data.items.slice(0, 12).map((x) => x.ar.full).join(" • ")}</p>
          </>
        )}
      </section>
      {saving === "failed" && <p className="text-[12.5px] text-bad" role="alert">{t("saveFailed")}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary min-h-[40px]" disabled={!ready || saving === "saving"}>{saveLabel ?? t("saveSet")}</button>
        <button type="button" className="btn min-h-[40px]" onClick={onCancel}>{t("cancel")}</button>
      </div>
    </form>
  );
}
