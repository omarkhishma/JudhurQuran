"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ContextInForce, EntryPage, Grouping } from "@/lib/editorial";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { DirectBar, ForceLine, useDirect } from "./Direct";
import { SourcesForm } from "./EntryView";

type SurahInfo = { number: number; name_ar: string; name_translit: string; verse_count: number };
type V = { ayah: number; key: string; text_qpc: string; tokens: { position: number; text: string }[]; words: { location: string; token_from: number; token_to: number }[] };
const SHOW = 40;

const digits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
const key = (s: number, a: number) => `${s}:${a}`;
const parse = (k: string) => digits(k).split(":").map(Number) as [number, number];

/** A verse key moved by one in the mushaf's order, across a sūra's end. */
function step(k: string, d: -1 | 1, surahs: SurahInfo[]): string {
  const [s, a] = parse(k);
  const count = surahs.find((x) => x.number === s)?.verse_count ?? 0;
  if (d === 1) return a < count ? key(s, a + 1) : s < 114 ? key(s + 1, 1) : k;
  if (a > 1) return key(s, a - 1);
  const prev = surahs.find((x) => x.number === s - 1);
  return prev ? key(prev.number, prev.verse_count) : k;
}

/** The verses from one key to another, as runs within each sūra, the first `SHOW` of them. */
function runs(from: string, to: string, surahs: SurahInfo[]): { s: number; a: number; b: number }[] {
  const [s1, a1] = parse(from);
  const [s2, a2] = parse(to);
  const out: { s: number; a: number; b: number }[] = [];
  let left = SHOW;
  for (let s = s1; s <= s2 && left > 0; s++) {
    const count = surahs.find((x) => x.number === s)?.verse_count ?? 0;
    const a = s === s1 ? a1 : 1;
    const b = Math.min(s === s2 ? a2 : count, a + left - 1);
    if (b >= a) out.push({ s, a, b });
    left -= Math.max(0, b - a + 1);
  }
  return out;
}

/**
 * A word's own context (P14.4, D32): the word in its verse; where its context starts and where it ends, moved verse
 * by verse or typed as «2:250»; the groupings the sources draw around it, each taken in one press; the context's
 * verses as the mushaf writes them with the word marked; and, if the administration writes one, what the word means
 * in this context — resting on a source (L2). It overrides the sūra's passage for this word only.
 */
export function WordContextTool({ location, role, onBack, back }: { location: string; role: string; onBack: () => void; back?: string }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const surahs = useQuery({ queryKey: ["surahs"], queryFn: () => getJSON<{ data: SurahInfo[] }>("/surahs"), staleTime: Infinity }).data?.data ?? [];
  const first = (page: EntryPage) => {
    const f = (page.candidates as { in_force: ContextInForce | null }).in_force;
    return { from: f?.from ?? page.target.verse_key, to: f?.to ?? page.target.verse_key, meaning_ar: "", meaning_en: "", note_ar: "" };
  };
  const work = useDirect("context_word", location, first);
  const page = work.page;
  const v = work.value as { from: string; to: string; meaning_ar: string; meaning_en: string; note_ar: string } | null;
  const parts = v && surahs.length ? runs(v.from, v.to, surahs) : [];
  const preview = useQuery({
    queryKey: ["ctx-preview", parts.map((p) => `${p.s}:${p.a}-${p.b}`).join(",")],
    enabled: parts.length > 0,
    queryFn: async () => (await Promise.all(parts.map((p) => getJSON<{ verses: V[] }>(`/surahs/${p.s}?start=${p.a}&end=${p.b}`)))).flatMap((x) => x.verses),
    placeholderData: (prev) => prev,
  });

  if (work.q.isPending) return <span className="block h-64 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!page || !v) return <p role="alert" className="text-[13px] text-t2">{t("loadFailed")}</p>;
  const tg = page.target;
  const cand = page.candidates as { groupings: Grouping[]; in_force: ContextInForce | null };
  const set = (p: Partial<typeof v>) => work.setValue({ ...v, ...p });
  const total = (() => {
    const [s1, a1] = parse(v.from);
    const [s2, a2] = parse(v.to);
    if (s1 === s2) return a2 - a1 + 1;
    let n = (surahs.find((x) => x.number === s1)?.verse_count ?? 0) - a1 + 1 + a2;
    for (let s = s1 + 1; s < s2; s++) n += surahs.find((x) => x.number === s)?.verse_count ?? 0;
    return n;
  })();
  const short = (id: string) => (t.has(`srcShort.${id}`) ? t(`srcShort.${id}`) : id);
  const crosses = parse(v.from)[0] !== parse(v.to)[0];

  const bound = (which: "from" | "to") => (
    <div key={which} className="flex items-center gap-1.5">
      <span className="w-12 text-[12.5px] text-t2">{t(which === "from" ? "ctxFrom" : "ctxTo")}</span>
      <button type="button" className="btn px-2" onClick={() => set({ [which]: step(v[which], -1, surahs) })} aria-label={`${t(which === "from" ? "ctxFrom" : "ctxTo")} — ${t("ctxEarlier")}`}>
        −
      </button>
      <input className="field-input w-24 text-center" value={v[which]} onChange={(e) => set({ [which]: digits(e.target.value.trim()) })} aria-label={t(which === "from" ? "ctxFrom" : "ctxTo")} dir="ltr" inputMode="numeric" />
      <button type="button" className="btn px-2" onClick={() => set({ [which]: step(v[which], 1, surahs) })} aria-label={`${t(which === "from" ? "ctxFrom" : "ctxTo")} — ${t("ctxLater")}`}>
        +
      </button>
      <span className="text-[12px] text-t3">{verseRef(v[which], locale)}</span>
    </div>
  );

  return (
    <article className="flex flex-col gap-4" aria-labelledby="ctxw-h">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn self-start text-[12.5px]" onClick={onBack}>{t("back")}</button>
        {back && (
          <Link href={back} className="btn self-start text-[12.5px]">
            {t("backToReader")}
          </Link>
        )}
      </div>
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 id="ctxw-h" className="quran text-[30px] leading-[1.6] text-t1" lang="ar">{tg.label}</h2>
        <span className="text-[12.5px] text-t3">{t("ctxWordAt", { place: verseRef(tg.verse_key, locale), n: formatNumber(tg.position, locale) })}</span>
        {tg.root_spaced && <span className="text-[12.5px] text-t3">{t("ctxWordRoot", { root: tg.root_spaced })}</span>}
      </header>

      {cand.in_force && (
        <p className="workbench-box is-force text-[12.5px] text-t2">
          {t(cand.in_force.level === "word" ? "ctxNowWord" : "ctxNowPassage", { from: verseRef(cand.in_force.from, locale), to: verseRef(cand.in_force.to, locale) })}{" "}
          <ForceLine by={cand.in_force.by} reviewed={cand.in_force.reviewed} at={cand.in_force.at} />
        </p>
      )}

      <div className="workbench-split">
        <section className="workbench-box" aria-labelledby="range-h">
          <h3 id="range-h" className="text-[14px] font-semibold">{t("ctxRange")}</h3>
          {bound("from")}
          {bound("to")}
          <p className="text-[12px] text-t3">
            {t("ctxRangeCount", cnt(total, locale))}
            {crosses && <span className="text-amber"> • {t("ctxCrosses")}</span>}
          </p>
          <label className="flex flex-col gap-1 text-[12px] text-t3">
            {t("ctxMeaningAr")}
            <textarea className="field-input min-h-[72px] text-[14px]" value={v.meaning_ar} onChange={(e) => set({ meaning_ar: e.target.value })} dir="rtl" lang="ar" maxLength={2000} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-t3">
            {t("ctxMeaningEn")}
            <textarea className="field-input min-h-[52px]" value={v.meaning_en} onChange={(e) => set({ meaning_en: e.target.value })} dir="ltr" lang="en" maxLength={2000} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-t3">
            {t("ctxNote")}
            <input className="field-input" value={v.note_ar} onChange={(e) => set({ note_ar: e.target.value })} dir="auto" maxLength={1000} />
          </label>
          <p className="text-[11.5px] text-t3">{t("ctxMeaningRests")}</p>
          <SourcesForm sources={work.sources} onSources={work.setSources} />
        </section>

        <section className="workbench-box" aria-labelledby="groups-h">
          <h3 id="groups-h" className="text-[14px] font-semibold">{t("ctxGroupings")}</h3>
          <p className="text-[11.5px] leading-relaxed text-t3">{t("ctxGroupingsLead")}</p>
          {cand.groupings.length === 0 ? (
            <p className="text-[12.5px] text-t2">{t("ctxGroupingsNone")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cand.groupings.map((g) => (
                <li key={`${g.from_id}-${g.to_id}`} className="flex flex-col gap-1 rounded-lg border border-line p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] text-t1">{t("ctxSpan", { from: verseRef(g.from, locale), to: verseRef(g.to, locale), ...cnt(g.verses, locale) })}</span>
                    <button type="button" className="chip text-[11.5px]" onClick={() => set({ from: g.from, to: g.to })}>{t("ctxUse")}</button>
                  </div>
                  <span className="flex flex-wrap gap-1 text-[11.5px] text-t3">
                    {g.sources.map((s, i) => (
                      <span key={i} className="bound-src" dir="auto">{s.kind === "topic" ? s.title_ar : short(s.source)}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="preview-h" className="flex flex-col gap-2">
        <h3 id="preview-h" className="text-[14px] font-semibold">{t("ctxPreview")}</h3>
        {total > SHOW && <p className="text-[12px] text-t3">{t("ctxPreviewFirst", cnt(SHOW, locale))}</p>}
        <ol className={"flex flex-col gap-2" + (preview.isFetching ? " opacity-60" : "")}>
          {(preview.data ?? []).map((pv) => {
            const w = pv.words.find((x) => x.location === location);
            return (
              <li key={pv.key} className="flex gap-3">
                <span className="mono w-14 shrink-0 pt-2 text-[11.5px] text-t3">{verseRef(pv.key, locale)}</span>
                <p className="quran text-[20px] leading-[2.1] text-t1" lang="ar" dir="rtl">
                  {w
                    ? [
                        ...pv.tokens.map((tk) => (
                          <span key={tk.position} className={tk.position >= w.token_from && tk.position <= w.token_to ? "ctx-word" : undefined}>
                            {tk.text}{" "}
                          </span>
                        )),
                        // the verse's end, as the mushaf's text writes it after its last word
                        pv.text_qpc.slice(pv.text_qpc.lastIndexOf(" ") + 1),
                      ]
                    : pv.text_qpc}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <DirectBar kind="context_word" target={location} work={work} role={role} />
    </article>
  );
}
