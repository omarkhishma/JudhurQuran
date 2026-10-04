"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ApiError } from "@/lib/account/store";
import { decideMany, getAwaiting, getTargets, saveVerdicts, STATES, type Ends, type Layer, type RelationRow, type State, type TopicLayerRow, type VerdictItem } from "@/lib/editorial";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { TopicPicker } from "./TopicPicker";
import type { Place } from "./Workbench";

type Mark = { verdict: VerdictItem["verdict"]; note: string; correction: string; ends: Ends; topicLabel?: string };
/** A root as an editor types it — "ع ر ف" or "عرف" — as the corpus keys it. */
const rootKey = (s: string) => s.replace(/[\s\u0640]+/g, "");
const remapped = (m: Mark) => Object.values(m.ends).some((v) => v && rootKey(v));

/**
 * The rows a book gave (P3.0): each with what the book says, the board's verdict — reviewed, corrected with the
 * correction, or rejected with why — sent for review in a batch; and the batch another editor wrote, approved or
 * sent back in one decision (each row still refused to its own author by the server).
 */
export function LayerView({ layer, state, q, onPlace }: { layer: Layer; state: State; q: string; onPlace: (p: Partial<Place>) => void }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const qc = useQueryClient();
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const list = useInfiniteQuery({
    queryKey: ["editorial-targets", "verdict", layer, state, q],
    queryFn: ({ pageParam }) => getTargets("verdict", { layer, state, q, offset: pageParam, limit: 50 }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const n = all.reduce((m, p) => m + p.data.length, 0);
      return n < last.total ? n : undefined;
    },
  });
  const waiting = useQuery({ queryKey: ["editorial-awaiting"], queryFn: getAwaiting });
  const mineToDecide = (waiting.data?.data ?? []).filter((e) => e.kind === "verdict" && e.target.startsWith(`${layer}:`));
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;
  // QSAC's tags (P8.3b): a verse is placed under an Arabic topic — a correction naming it, its reason optional — or
  // the tag is rejected with why; never accepted as QSAC's English tag
  const placing = layer === "topic_candidates";
  const choices = placing ? (["corrected", "rejected"] as const) : (["reviewed", "corrected", "rejected"] as const);
  const marked = Object.entries(marks).filter(([, m]) =>
    placing ? (m.verdict === "corrected" ? !!m.ends.topic : !!m.note.trim()) : m.verdict === "reviewed" || (m.note.trim() && (m.verdict !== "corrected" || m.correction.trim() || remapped(m))),
  );

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      setMarks({});
      setNote("");
      setSaid(done);
      await Promise.all(["editorial-targets", "editorial-awaiting", "editorial-worklists"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    } catch (e) {
      setSaid(e instanceof ApiError ? e.message : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="layer-h">
      <h2 id="layer-h" className="text-[16px] font-semibold">{t(`layer_${layer}`)}</h2>
      <p className="text-[12.5px] leading-relaxed text-t3">{t("layerLead")}</p>

      {mineToDecide.length > 0 && (
        <div className="workbench-box" role="group" aria-label={t("batchReview")}>
          <p className="text-[13px] text-t1">{t("batchWaiting", cnt(mineToDecide.length, locale))}</p>
          <label className="flex flex-col gap-1 text-[12px] text-t3">
            {t("note")}
            <input className="field-input" value={note} onChange={(e) => setNote(e.target.value)} dir="auto" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(() => decideMany(mineToDecide.map((e) => e.id), "approve", note), t("saidBatchApproved", cnt(mineToDecide.length, locale)))}>
              {t("approveAll")}
            </button>
            <button type="button" className="btn" disabled={busy || !note.trim()} onClick={() => void run(() => decideMany(mineToDecide.map((e) => e.id), "changes", note), t("saidBatchChanges", cnt(mineToDecide.length, locale)))}>
              {t("askChangesAll")}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="seg-group" role="group" aria-label={t("state")}>
          {STATES.map((s) => (
            <button key={s} type="button" className={"seg" + (state === s ? " is-on" : "")} aria-pressed={state === s} onClick={() => onPlace({ state: s })}>
              {t(`state_${s}`)}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-t3" role="status">{list.isPending ? "" : t("found", cnt(total, locale))}</span>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const id = r.key.split(":").slice(1).join(":");
          const m = marks[id];
          const free = r.state === "todo";
          return (
            <li key={r.key} className="workbench-box">
              <div className="flex flex-wrap items-baseline gap-2">
                <button type="button" className={placing ? "text-[14px] font-medium text-t1 hover:underline" : "ar-classical text-[17px] text-t1 hover:underline"} lang={placing ? "en" : "ar"} dir="auto" onClick={() => onPlace({ target: r.key })}>
                  {r.label || id}
                </button>
                <span className="mono text-[11px] text-t3" dir="ltr">{id}</span>
                <span className="flex-1" />
                <span className={`state-chip is-${r.state}`}>{t(`state_${r.state}`)}</span>
              </div>
              {r.relation && <RelationHead rel={r.relation} />}
              {r.topic ? <TopicHead row={r.topic} placing={placing} /> : r.sub && <p className="ar-classical line-clamp-4 text-[14px] leading-[1.9] text-t2" lang="ar" dir="rtl">{r.sub}</p>}
              {r.relation && r.relation.verses.length > 0 && (
                <p className="text-[11.5px] text-t3">{t("relVerses", { ...cnt(r.relation.verses.length, locale), list: r.relation.verses.slice(0, 6).map((v) => verseRef(v, locale)).join("، ") })}</p>
              )}
              {free && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("verdict")}>
                    {choices.map((v) => (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={m?.verdict === v}
                        className={"chip" + (m?.verdict === v ? " is-on" : "")}
                        onClick={() => setMarks((x) => (x[id]?.verdict === v ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== id)) : { ...x, [id]: { verdict: v, note: x[id]?.note ?? "", correction: x[id]?.correction ?? "", ends: x[id]?.ends ?? {} } }))}
                      >
                        {t(placing && v === "corrected" ? "verdict_placed" : `verdict_${v}`)}
                      </button>
                    ))}
                  </div>
                  {m && placing && m.verdict === "corrected" && (
                    <TopicPicker value={m.ends.topic ?? ""} label={m.topicLabel} onPick={(topic, label) => setMarks((x) => ({ ...x, [id]: { ...m, ends: { topic }, topicLabel: label } }))} />
                  )}
                  {m && m.verdict !== "reviewed" && (
                    <input className="field-input" value={m.note} onChange={(e) => setMarks((x) => ({ ...x, [id]: { ...m, note: e.target.value } }))} placeholder={t(placing && m.verdict === "corrected" ? "whyOptional" : "why")} aria-label={t(placing && m.verdict === "corrected" ? "whyOptional" : "why")} dir="auto" />
                  )}
                  {m?.verdict === "corrected" && !placing && (
                    <textarea className="field-input min-h-[52px]" value={m.correction} onChange={(e) => setMarks((x) => ({ ...x, [id]: { ...m, correction: e.target.value } }))} placeholder={t("correction")} aria-label={t("correction")} dir="auto" />
                  )}
                  {m?.verdict === "corrected" && r.relation && (
                    // the commonest fault in an extracted relation: a word mapped to the wrong root
                    <div className="flex flex-col gap-1">
                      <p className="text-[11.5px] text-t3">{t("remapHint")}</p>
                      <div className="flex flex-wrap gap-2">
                        {(r.relation.target_ar ? (["root", "target_root"] as const) : (["root"] as const)).map((end) => (
                          <label key={end} className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-t3">
                            {t("endRoot", { word: end === "root" ? r.relation!.headword_ar : r.relation!.target_ar! })}
                            <input
                              className="field-input ar-classical w-28 text-[16px]"
                              lang="ar"
                              dir="rtl"
                              value={m.ends[end] ?? ""}
                              placeholder={[...((end === "root" ? r.relation!.root : r.relation!.target_root) ?? "")].join(" ")}
                              onChange={(e) => setMarks((x) => ({ ...x, [id]: { ...m, ends: { ...m.ends, [end]: e.target.value } } }))}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {list.hasNextPage && (
        <button type="button" className="btn self-start" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
          {t("more")}
        </button>
      )}
      <div className="workbench-bar">
        <span className="text-[12.5px] text-t2">{t("marked", cnt(marked.length, locale))}</span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !marked.length}
          onClick={() =>
            void run(
              () =>
                saveVerdicts(
                  layer,
                  marked.map(([row, m]) => {
                    const ends = Object.fromEntries(Object.entries(m.ends).map(([k, v]) => [k, rootKey(v ?? "")]).filter(([, v]) => v));
                    if (placing) return { row, verdict: m.verdict, ...(m.note.trim() ? { note: m.note.trim() } : {}), ...(m.verdict === "corrected" ? { ends: { topic: m.ends.topic } } : {}) };
                    return { row, verdict: m.verdict, ...(m.note.trim() ? { note: m.note.trim() } : {}), ...(m.verdict === "corrected" ? { correction: m.correction.trim() } : {}), ...(m.verdict === "corrected" && Object.keys(ends).length ? { ends } : {}) };
                  }),
                  true,
                ),
              t("saidBatchSent", cnt(marked.length, locale)),
            )
          }
        >
          {t("sendForReview")}
        </button>
        <span className="text-[12.5px] text-t2" role="status" aria-live="polite">{said}</span>
        <span className="sr-only">{formatNumber(rows.length, locale)}</span>
      </div>
    </section>
  );
}

/** A relation row's head (P8.4): what kind of relation the book draws, its ends with the roots they were mapped to
 * (said when the mapping is unsure), and the sense it names. */
function RelationHead({ rel }: { rel: RelationRow }) {
  const t = useTranslations("workbench");
  const end = (word: string, root: string | null, sure: string | null) => (
    <span className="inline-flex items-baseline gap-1">
      <span className="ar-classical text-[16px] text-t1" lang="ar">{word}</span>
      <span className="text-[12px] text-t3">({root ? <span lang="ar">{[...root].join(" ")}</span> : t("noRootMapped")}{root && sure && sure !== "high" ? ` · ${t("unsure")}` : ""})</span>
    </span>
  );
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12.5px]">
      <span className="state-chip">{t(`relType_${rel.type}`)}</span>
      {end(rel.headword_ar, rel.root, rel.match_confidence)}
      {rel.target_ar && (
        <>
          <span className="text-t3" aria-hidden="true">↔</span>
          {end(rel.target_ar, rel.target_root, rel.target_match_confidence)}
        </>
      )}
      {rel.sense_label_ar && <span className="text-t2">— {rel.sense_label_ar}</span>}
    </p>
  );
}

/** A topic layer's row (P8.3b): where the source places the topic — or, for QSAC's tag, its domain and category with
 * QSAC's description — and the verse in the mushaf's text. */
function TopicHead({ row, placing }: { row: TopicLayerRow; placing: boolean }) {
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-1">
      {placing ? (
        <p className="text-[12px] text-t3" dir="ltr" lang="en">
          {[row.grand_en, row.parent_en].filter(Boolean).join(" › ")}
          {row.description ? ` — ${row.description}` : ""}
        </p>
      ) : (
        row.parent_ar && <p className="text-[12px] text-t3" lang="ar">{row.parent_ar}</p>
      )}
      <p className="flex items-baseline gap-2">
        <span className="mono shrink-0 text-[11px] text-t3">{verseRef(row.verse_key, locale)}</span>
        <span className="quran line-clamp-3 text-[19px] leading-[2] text-t1" lang="ar" dir="rtl">{row.verse_text}</span>
      </p>
    </div>
  );
}
