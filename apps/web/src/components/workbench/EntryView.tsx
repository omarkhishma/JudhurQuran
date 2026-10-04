"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ApiError } from "@/lib/account/store";
import { decideEntry, discardEntry, getEntry, getWorks, saveEntry, submitEntry, withdrawEntry, type Entry, type EntryPage, type Kind, type Source } from "@/lib/editorial";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { TopicPicker } from "./TopicPicker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Value = any;

/** An empty value of each kind, for a first draft. */
function blank(kind: Kind, page: EntryPage): Value {
  switch (kind) {
    case "root_gloss":
      return { en: "" };
    case "root_core":
      // Ibn Fāris's statement as cut, to confirm or correct
      return { ar: page.target.gist_ar ?? "", kept: "source" };
    case "pattern_function":
      return { ar: "", en: "", rows: [] };
    case "pattern_plain":
      return { ar: "", en: "" };
    case "sense_list":
      return { senses: [] };
    case "glossary":
      return { body_ar: page.target.body_ar ?? "", body_en: page.target.body_en ?? "" };
    case "topic":
      // the source's name and place kept until the board writes its own
      return { name_ar: "", name_en: "", under: "" };
    default:
      return { verdict: "reviewed", note: "" };
  }
}

/**
 * A target's page (P3.0): what is in force on it, by whom and approved by whom; the sources' candidates, each cited
 * or used in one click (verbatim, with its citation — never wording of the tool's own, L2); the form of the kind,
 * written by its author and saved, submitted, withdrawn or discarded; the review — another editor approves the
 * revision or asks for changes with a note; the history.
 */
export function EntryView({ kind, target, onBack }: { kind: Kind; target: string; onBack: () => void }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["editorial-entry", kind, target], queryFn: () => getEntry(kind, target), refetchOnWindowFocus: true });
  const [draft, setDraft] = useState<{ value: Value; sources: Source[] } | null>(null);
  const [said, setSaid] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const page = q.data;
  const open = page?.open ?? null;
  const mine = !open || !!open.mine;
  const editing = !!page && mine && (!open || open.status !== "review");
  const value: Value = draft?.value ?? open?.value ?? (page ? (page.in_force?.value ?? blank(kind, page)) : null);
  const sources: Source[] = draft?.sources ?? open?.sources ?? page?.in_force?.sources ?? [];
  const set = (v: Value) => setDraft({ value: v, sources });
  const cite = (s: Source) => setDraft({ value, sources: sources.some((x) => x.work === s.work && x.ref === s.ref && x.quote === s.quote) ? sources : [...sources, s] });

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      setDraft(null);
      setNote("");
      setSaid(done);
      await qc.invalidateQueries({ queryKey: ["editorial-entry", kind, target] });
      void qc.invalidateQueries({ queryKey: ["editorial-worklists"] });
      void qc.invalidateQueries({ queryKey: ["editorial-targets"] });
      void qc.invalidateQueries({ queryKey: ["editorial-awaiting"] });
    } catch (e) {
      setSaid(e instanceof ApiError ? e.message : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  if (q.isPending) return <span className="block h-64 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!page) return <p role="alert" className="text-[13px] text-t2">{t("loadFailed")}</p>;
  const tg = page.target;
  return (
    <article className="flex flex-col gap-4" aria-labelledby="entry-h">
      <button type="button" className="btn self-start text-[12.5px]" onClick={onBack}>{t("back")}</button>
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 id="entry-h" className="ar-classical text-[30px] leading-[1.3] text-t1" lang="ar" dir="auto">{tg.label || (kind === "topic" ? t("newTopic") : "")}</h2>
        {tg.translit && <span className="mono text-[13px] text-t3" dir="ltr">{tg.translit}</span>}
        <span className="text-[12.5px] text-t3">{t(`kind_${kind}`)}</span>
        {tg.occurrences != null && kind !== "glossary" && <span className="text-[12.5px] text-t3">{t("occurrences", { n: formatNumber(tg.occurrences, locale) })}</span>}
      </header>

      {page.in_force && (
        <section className="workbench-box is-force" aria-label={t("inForce")}>
          <p className="label-caps">{t("inForce")}</p>
          <ValueView kind={kind} value={page.in_force.value} sources={page.in_force.sources} />
          <p className="text-[11.5px] text-t3">{t("inForceBy", { by: page.in_force.author.name ?? t("anEditor"), date: page.in_force.decided_at ? new Date(page.in_force.decided_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB") : "" })}</p>
        </section>
      )}

      <div className="workbench-split">
        <section className="workbench-box" aria-labelledby="work-h">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="work-h" className="text-[14px] font-semibold">{open ? t(`status_${open.status}`) : page.in_force ? t("newRevision") : t("newDraft")}</h3>
            {open && <span className="text-[12px] text-t3">{t("byRevision", { name: open.mine ? t("you") : (open.author.name ?? t("anEditor")), n: formatNumber(open.revision, locale) })}</span>}
          </div>
          {editing ? <Form kind={kind} page={page} value={value} sources={sources} onValue={set} onSources={(s) => setDraft({ value, sources: s })} /> : open ? <ValueView kind={kind} value={open.value} sources={open.sources} /> : null}
          {page.decisions.length > 0 && (
            <ul className="flex flex-col gap-1 text-[12.5px]">
              {page.decisions.map((d, i) => (
                <li key={i} className={d.decision === "changes" ? "text-amber" : "text-good"}>
                  {t(d.decision === "approve" ? "decidedApprove" : "decidedChanges", { name: d.by ?? t("anEditor"), n: formatNumber(d.revision, locale) })}
                  {d.note && <span className="text-t2"> — {d.note}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {editing && (
              <button type="button" className="btn" disabled={busy || !draft} onClick={() => void act(() => saveEntry(kind, target, value, sources), t("saidSaved"))}>
                {t("save")}
              </button>
            )}
            {open?.mine && (open.status === "draft" || open.status === "changes") && (
              <button type="button" className="btn btn-primary" disabled={busy || !!draft} onClick={() => void act(() => submitEntry(open.id), t("saidSubmitted"))} title={draft ? t("saveFirst") : undefined}>
                {t("submit")}
              </button>
            )}
            {open?.mine && open.status === "review" && (
              <button type="button" className="btn" disabled={busy} onClick={() => void act(() => withdrawEntry(open.id), t("saidWithdrawn"))}>
                {t("withdraw")}
              </button>
            )}
            {open?.mine && (open.status === "draft" || open.status === "changes") && (
              <button type="button" className="btn" disabled={busy} onClick={() => void act(() => discardEntry(open.id), t("saidDiscarded"))}>
                {t("discard")}
              </button>
            )}
          </div>
          {open && !open.mine && open.status === "review" && <Review entry={open} busy={busy} note={note} setNote={setNote} onDecide={(d) => void act(() => decideEntry(open.id, d, note), t(d === "approve" ? "saidApproved" : "saidChanges"))} />}
          {open?.mine && open.status === "review" && <p className="text-[12.5px] text-t3">{t("waitsOnAnother")}</p>}
          <p className="text-[12.5px] text-t2" role="status" aria-live="polite">{said}</p>
        </section>

        <section className="workbench-box" aria-labelledby="cand-h">
          <h3 id="cand-h" className="text-[14px] font-semibold">{t("candidates")}</h3>
          <p className="text-[11.5px] leading-relaxed text-t3">{t("candidatesLead")}</p>
          <Candidates kind={kind} page={page} canUse={editing} onCite={cite} onUse={(v, s) => setDraft({ value: v(value), sources: s ? [...sources.filter((x) => !(x.work === s.work && x.ref === s.ref)), s] : sources })} />
        </section>
      </div>

      {page.history.length > 0 && (
        <section aria-labelledby="hist-h">
          <h3 id="hist-h" className="label-caps mb-1">{t("history")}</h3>
          <ol className="flex flex-col gap-0.5 text-[12px] text-t3">
            {page.history.map((h, i) => (
              <li key={i}>
                {t(`action_${h.action}`, { name: h.by ?? t("anEditor"), n: formatNumber(h.revision, locale) })} · {new Date(h.at).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB")}
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

/** Another editor's decision on a revision: approve, or ask for changes with a note (the note is required then). */
function Review({ entry, busy, note, setNote, onDecide }: { entry: Entry; busy: boolean; note: string; setNote: (s: string) => void; onDecide: (d: "approve" | "changes") => void }) {
  const t = useTranslations("workbench");
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3" role="group" aria-label={t("review")}>
      <p className="text-[12.5px] text-t2">{t("reviewLead")}</p>
      <label className="flex flex-col gap-1 text-[12px] text-t3">
        {t("note")}
        <textarea className="field-input min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} dir="auto" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onDecide("approve")}>{t("approve")}</button>
        <button type="button" className="btn" disabled={busy || !note.trim()} onClick={() => onDecide("changes")} title={!note.trim() ? t("changesNeedNote") : undefined}>
          {t("askChanges")}
        </button>
      </div>
      <span className="sr-only">{entry.id}</span>
    </div>
  );
}

/** A value read back in its kind's shape, with its sources. */
function ValueView({ kind, value, sources }: { kind: Kind; value: Value; sources: Source[] }) {
  const t = useTranslations("workbench");
  return (
    <div className="flex flex-col gap-1.5">
      {kind === "root_gloss" && <p className="text-[15px] text-t1" dir="ltr" lang="en">{value.en}</p>}
      {kind === "root_core" && (
        <>
          <p className="ar-classical text-[16px] leading-[1.9] text-t1" lang="ar">{value.ar}</p>
          <p className="text-[12px] text-t3">{t(value.kept === "source" ? "keptSource" : "keptCorrected")}</p>
        </>
      )}
      {(kind === "pattern_function" || kind === "pattern_plain") && (
        <>
          {value.ar && <p className="text-[14.5px] leading-relaxed text-t1" lang="ar" dir="rtl">{value.ar}</p>}
          {value.en && <p className="text-[13.5px] leading-relaxed text-t1" lang="en" dir="ltr">{value.en}</p>}
        </>
      )}
      {kind === "sense_list" && (
        <ol className="flex flex-col gap-1.5">
          {(value.senses as { ar: string; en: string; sources: Source[] }[]).map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="mono text-[11px] text-t3">{i + 1}</span>
              <span className="flex min-w-0 flex-col">
                {s.ar && <span className="text-[14.5px] text-t1" lang="ar" dir="rtl">{s.ar}</span>}
                {s.en && <span className="text-[13px] text-t2" lang="en" dir="ltr">{s.en}</span>}
                <SourceList sources={s.sources} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {kind === "glossary" && (
        <>
          {value.body_ar && <p className="text-[14px] leading-relaxed text-t1" lang="ar" dir="rtl">{value.body_ar}</p>}
          {value.body_en && <p className="text-[13px] leading-relaxed text-t1" lang="en" dir="ltr">{value.body_en}</p>}
        </>
      )}
      {kind === "topic" && (
        <>
          {value.name_ar ? <p className="text-[16px] text-t1" lang="ar" dir="rtl">{value.name_ar}</p> : <p className="text-[12.5px] text-t3">{t("topicNameKept")}</p>}
          {value.name_en && <p className="text-[13px] text-t2" lang="en" dir="ltr">{value.name_en}</p>}
          <p className="text-[12.5px] text-t2">{value.under === "top" ? t("topicAtTop") : value.under ? <>{t("placedUnder")} <TopicName id={value.under} /></> : t("topicWhereSource")}</p>
        </>
      )}
      {kind === "verdict" && (
        <p className="text-[13.5px] text-t1">
          {t(`verdict_${value.verdict}`)}
          {value.note && <span className="text-t2"> — {value.note}</span>}
          {value.correction && <span className="block text-t1" dir="auto">{value.correction}</span>}
          {value.ends && (
            <span className="block text-[12.5px] text-t2">
              {value.ends.topic ? (
                <>
                  {t("remappedTopic", { topic: "" })}
                  <TopicName id={value.ends.topic} />
                </>
              ) : (
                Object.entries(value.ends as Record<string, string>).map(([end, root]) => t(end === "root" ? "remappedFirst" : "remappedSecond", { root: [...root].join(" ") })).join(" · ")
              )}
            </span>
          )}
        </p>
      )}
      <SourceList sources={sources} />
    </div>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <ul className="flex flex-col gap-0.5 text-[11.5px] text-t3">
      {sources.map((s, i) => (
        <li key={i} dir="auto">
          <span className="font-medium text-t2">{s.work}</span>
          {s.ref && <> · <bdi>{s.ref}</bdi></>}
          {s.quote && <span className="block truncate">«{s.quote}»</span>}
        </li>
      ))}
    </ul>
  );
}

/** The form of each kind (P3.0): the fields the content will show, and the sources the work rests on. */
function Form({ kind, page, value, sources, onValue, onSources }: { kind: Kind; page: EntryPage; value: Value; sources: Source[]; onValue: (v: Value) => void; onSources: (s: Source[]) => void }) {
  const t = useTranslations("workbench");
  const field = "field-input";
  return (
    <div className="flex flex-col gap-2">
      {kind === "root_gloss" && (
        <label className="flex flex-col gap-1 text-[12px] text-t3">
          {t("glossEn")}
          <input className={field} value={value.en} maxLength={200} onChange={(e) => onValue({ en: e.target.value })} dir="ltr" lang="en" />
        </label>
      )}
      {kind === "root_core" && (
        <>
          <fieldset className="flex flex-wrap gap-3 text-[12.5px]">
            <legend className="sr-only">{t("coreKept")}</legend>
            {(["source", "corrected"] as const).map((k) => (
              <label key={k} className="flex items-center gap-1.5">
                <input type="radio" name="kept" checked={value.kept === k} onChange={() => onValue({ ...value, kept: k, ar: k === "source" ? (page.target.gist_ar ?? value.ar) : value.ar })} />
                {t(k === "source" ? "keptSource" : "keptCorrected")}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-[12px] text-t3">
            {t("coreAr")}
            <textarea className={`${field} ar-classical min-h-[96px] text-[16px]`} value={value.ar} readOnly={value.kept === "source"} onChange={(e) => onValue({ ...value, ar: e.target.value })} dir="rtl" lang="ar" />
          </label>
        </>
      )}
      {(kind === "pattern_function" || kind === "pattern_plain") && (
        <>
          <label className="flex flex-col gap-1 text-[12px] text-t3">
            {t("textAr")}
            <textarea className={`${field} min-h-[80px]`} value={value.ar} onChange={(e) => onValue({ ...value, ar: e.target.value })} dir="rtl" lang="ar" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-t3">
            {t("textEn")}
            <textarea className={`${field} min-h-[80px]`} value={value.en} onChange={(e) => onValue({ ...value, en: e.target.value })} dir="ltr" lang="en" />
          </label>
          {kind === "pattern_plain" && <p className="text-[11.5px] text-t3">{t("plainIsOurs")}</p>}
          {kind === "pattern_function" && value.rows?.length > 0 && <p className="text-[11.5px] text-t3">{t("rowsQuoted", { ids: value.rows.join("، ") })}</p>}
        </>
      )}
      {kind === "sense_list" && <SensesForm value={value} onValue={onValue} />}
      {kind === "topic" && <TopicForm page={page} value={value} onValue={onValue} />}
      {kind === "glossary" && (
        <>
          <label className="flex flex-col gap-1 text-[12px] text-t3">
            {t("bodyAr")}
            <textarea className={`${field} min-h-[96px]`} value={value.body_ar} onChange={(e) => onValue({ ...value, body_ar: e.target.value })} dir="rtl" lang="ar" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-t3">
            {t("bodyEn")}
            <textarea className={`${field} min-h-[96px]`} value={value.body_en} onChange={(e) => onValue({ ...value, body_en: e.target.value })} dir="ltr" lang="en" />
          </label>
        </>
      )}
      {kind !== "sense_list" && <SourcesForm sources={sources} onSources={onSources} />}
    </div>
  );
}

/** A sense list: numbered senses, each in Arabic, English or both, each with its own sources; reordered, removed. */
function SensesForm({ value, onValue }: { value: Value; onValue: (v: Value) => void }) {
  const t = useTranslations("workbench");
  const senses = value.senses as { ar: string; en: string; sources: Source[] }[];
  const put = (i: number, s: Partial<(typeof senses)[number]>) => onValue({ senses: senses.map((x, j) => (j === i ? { ...x, ...s } : x)) });
  const move = (i: number, d: -1 | 1) => {
    const next = [...senses];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onValue({ senses: next });
  };
  return (
    <div className="flex flex-col gap-2">
      {senses.length === 0 && <p className="text-[12.5px] text-t3">{t("sensesEmpty")}</p>}
      {senses.map((s, i) => (
        <fieldset key={i} className="flex flex-col gap-1.5 rounded-lg border border-line p-2">
          <legend className="px-1 text-[12px] text-t3">{t("senseN", { n: i + 1 })}</legend>
          <textarea className="field-input min-h-[52px]" value={s.ar} onChange={(e) => put(i, { ar: e.target.value })} dir="rtl" lang="ar" aria-label={t("textAr")} />
          <textarea className="field-input min-h-[44px]" value={s.en} onChange={(e) => put(i, { en: e.target.value })} dir="ltr" lang="en" aria-label={t("textEn")} />
          <SourcesForm sources={s.sources} onSources={(src) => put(i, { sources: src })} />
          <div className="flex gap-1.5">
            <button type="button" className="btn text-[12px]" disabled={i === 0} onClick={() => move(i, -1)}>{t("up")}</button>
            <button type="button" className="btn text-[12px]" disabled={i === senses.length - 1} onClick={() => move(i, 1)}>{t("down")}</button>
            <button type="button" className="btn text-[12px]" onClick={() => onValue({ senses: senses.filter((_, j) => j !== i) })}>{t("remove")}</button>
          </div>
        </fieldset>
      ))}
      <button type="button" className="btn self-start text-[12.5px]" onClick={() => onValue({ senses: [...senses, { ar: "", en: "", sources: [] }] })}>{t("addSense")}</button>
    </div>
  );
}

/** The sources a piece of work rests on: a work and where in it, and the words quoted when it quotes. */
function SourcesForm({ sources, onSources }: { sources: Source[]; onSources: (s: Source[]) => void }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  // the works the reader shows by title: a source named by one of these ids is cited by its title there
  const works = useQuery({ queryKey: ["editorial-works"], queryFn: getWorks, staleTime: Infinity }).data?.data ?? [];
  const title = (id: string) => {
    const w = works.find((x) => x.id === id);
    return w ? (locale === "ar" ? w.title_ar : w.title_en) : "";
  };
  const put = (i: number, s: Partial<Source>) => onSources(sources.map((x, j) => (j === i ? { ...x, ...s } : x)));
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12px] text-t3">{t("sources")}</p>
      <datalist id="editorial-works">
        {works.map((w) => (
          <option key={w.id} value={w.id}>{locale === "ar" ? w.title_ar : w.title_en}</option>
        ))}
      </datalist>
      {sources.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <input className="field-input w-36" list="editorial-works" value={s.work} onChange={(e) => put(i, { work: e.target.value })} aria-label={t("sourceWork")} placeholder={t("sourceWork")} dir="ltr" />
          <input className="field-input min-w-0 flex-1" value={s.ref} onChange={(e) => put(i, { ref: e.target.value })} aria-label={t("sourceRef")} placeholder={t("sourceRef")} dir="auto" />
          <button type="button" className="field-remove" onClick={() => onSources(sources.filter((_, j) => j !== i))} aria-label={t("sourceRemove")}>×</button>
          <span className={"w-full text-[11.5px] " + (s.work && !title(s.work) ? "text-amber" : "text-t3")} dir="auto">
            {s.work ? title(s.work) || t("workUnknown") : ""}
          </span>
          {s.quote && <span className="w-full truncate text-[11.5px] text-t3" dir="auto">«{s.quote}»</span>}
        </div>
      ))}
      <button type="button" className="btn self-start text-[12px]" onClick={() => onSources([...sources, { work: "", ref: "" }])}>{t("addSource")}</button>
    </div>
  );
}

/**
 * The sources' candidates for a target: verbatim slices and counts, each with a button to cite it and, where the
 * kind takes it, to use it — its words go into the form as the source gives them, its citation with them.
 */
function Candidates({ kind, page, canUse, onCite, onUse }: { kind: Kind; page: EntryPage; canUse: boolean; onCite: (s: Source) => void; onUse: (v: (old: Value) => Value, s?: Source) => void }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const c = page.candidates;
  const cite = (s: Source) =>
    canUse ? (
      <button type="button" className="chip self-start text-[11px]" onClick={() => onCite(s)}>
        {t("cite")}
      </button>
    ) : null;
  const use = (v: (old: Value) => Value, s: Source) =>
    canUse ? (
      <button type="button" className="chip self-start text-[11px]" onClick={() => onUse(v, s)}>
        {t("use")}
      </button>
    ) : null;
  if (kind === "root_gloss" || kind === "root_core")
    return (
      <div className="flex flex-col gap-3">
        {c.core && (
          <figure className="cand">
            <figcaption>{t("candCore")}</figcaption>
            <blockquote className="ar-classical text-[15px] leading-[1.9]" lang="ar">{c.core.ar}</blockquote>
            {cite({ work: "maqayis", ref: c.core.source?.page_ref ?? "", quote: c.core.ar })}
          </figure>
        )}
        {kind === "root_gloss" && c.word_glosses?.length > 0 && (
          <div className="cand">
            <p className="cand-h">{t("candWordGlosses")}</p>
            <ul className="flex flex-col gap-1">
              {c.word_glosses.map((w: { slug: string; ar: string; gloss_en: string; occurrences: number }) => (
                <li key={w.slug} className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="ar-classical text-[16px]" lang="ar">{w.ar}</span>
                  <span dir="ltr" lang="en">{w.gloss_en}</span>
                  <span className="mono text-[11px] text-t3">{formatNumber(w.occurrences, locale)}</span>
                  {use(() => ({ en: w.gloss_en }), { work: "qac-wbw", ref: w.slug, quote: w.gloss_en })}
                </li>
              ))}
            </ul>
          </div>
        )}
        {c.lane && <Article title={t("candLane")} body={c.lane.body} cut={c.lane.length > c.lane.body.length} lang="en" cite={cite({ work: "lane", ref: c.lane.page_ref ?? "" })} />}
        {c.maqayis && <Article title={t("candMaqayis")} body={c.maqayis.body} cut={c.maqayis.length > c.maqayis.body.length} lang="ar" cite={cite({ work: "maqayis", ref: c.maqayis.page_ref ?? "" })} />}
      </div>
    );
  if (kind === "pattern_function" || kind === "pattern_plain") {
    const rows = (c.classical?.rows ?? []) as { id: string; source_id: string; heading_ar: string | null; text_ar: string; page_vol: string | null; page: string | null }[];
    const sources = (c.classical?.sources ?? []) as { id: string; title_ar: string; title_en: string }[];
    if (!rows.length) return <p className="text-[12.5px] text-t3">{t("candNone")}</p>;
    return (
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const src = sources.find((s) => s.id === r.source_id);
          const ref = [r.page_vol, r.page].filter(Boolean).join("/");
          const s: Source = { work: r.source_id, ref, quote: r.text_ar };
          return (
            <li key={r.id} className="cand">
              <p className="cand-h">{src ? (locale === "ar" ? src.title_ar : src.title_en) : r.source_id}{r.heading_ar ? ` · ${r.heading_ar}` : ""}{ref ? ` · ${ref}` : ""}</p>
              <p className="ar-classical line-clamp-6 whitespace-pre-wrap text-[14px] leading-[1.9]" lang="ar">{r.text_ar}</p>
              <div className="flex gap-1.5">
                {cite(s)}
                {kind === "pattern_function" && use((old) => ({ ...old, ar: r.text_ar, rows: [...new Set([...(old.rows ?? []), r.id])] }), s)}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  if (kind === "sense_list") {
    const addSense = (ar: string, s: Source) => onUse((old) => ({ senses: [...(old.senses ?? []), { ar, en: "", sources: [s] }] }));
    return (
      <div className="flex flex-col gap-3">
        {c.corpus_gloss && <p className="text-[12.5px] text-t2">{t("candCorpusGloss")}: <span dir="ltr" lang="en">{c.corpus_gloss}</span></p>}
        {c.mufradat?.map((m: { id: string; headword_ar: string; text_ar: string; page_ref: string | null }) => (
          <figure key={m.id} className="cand">
            <figcaption>{t("candMufradat")} · {m.headword_ar}{m.page_ref ? ` · ${m.page_ref}` : ""}</figcaption>
            <blockquote className="ar-classical line-clamp-6 text-[14px] leading-[1.9]" lang="ar">{m.text_ar}</blockquote>
            {canUse && <button type="button" className="chip self-start text-[11px]" onClick={() => addSense(m.text_ar, { work: "mufradat", ref: m.page_ref ?? m.id, quote: m.text_ar })}>{t("useAsSense")}</button>}
          </figure>
        ))}
        {c.muyassar?.length > 0 && (
          <div className="cand">
            <p className="cand-h">{t("candMuyassar")}</p>
            <ul className="flex flex-col gap-1">
              {c.muyassar.map((m: { meaning_ar: string; phrase_ar: string; places: number; first: number }, i: number) => {
                const ref = `${Math.floor(m.first / 1000)}:${m.first % 1000}`;
                return (
                  <li key={i} className="flex flex-wrap items-baseline gap-2 text-[13.5px]" lang="ar">
                    <span className="text-word">{m.phrase_ar}</span>: {m.meaning_ar}
                    <span className="mono text-[11px] text-t3">{t("places", cnt(m.places, locale))}</span>
                    {canUse && <button type="button" className="chip text-[11px]" onClick={() => addSense(m.meaning_ar, { work: "kfgqpc-muyassar-gharib", ref, quote: m.meaning_ar })}>{t("useAsSense")}</button>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {c.wujuh?.length > 0 && (
          <div className="cand">
            <p className="cand-h">{t("candWujuh")}</p>
            <ul className="flex flex-col gap-1">
              {c.wujuh.map((w: { id: string; source_id: string; sense_label_ar: string | null; text_ar: string; page_vol: string | null; page: string | null }) => (
                <li key={w.id} className="text-[13.5px]" lang="ar">
                  <span className="text-t3">{w.source_id}</span> {w.sense_label_ar && <span className="text-word">{w.sense_label_ar}</span>} {w.text_ar}
                  {canUse && <button type="button" className="chip ms-2 text-[11px]" onClick={() => addSense(w.sense_label_ar || w.text_ar, { work: w.source_id, ref: [w.page_vol, w.page].filter(Boolean).join("/"), quote: w.text_ar })}>{t("useAsSense")}</button>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {c.lane && <Article title={t("candLane")} body={c.lane.body} cut={c.lane.length > c.lane.body.length} lang="en" cite={null} />}
        {!c.mufradat?.length && !c.muyassar?.length && !c.wujuh?.length && <p className="text-[12.5px] text-t3">{t("candNone")}</p>}
      </div>
    );
  }
  if (kind === "topic") return <TopicCandidates c={c} cite={cite} />;
  if (kind === "glossary")
    return (
      <div className="cand">
        <p className="cand-h">{t("candCurrent")}</p>
        {c.current?.body_ar && <p className="text-[13.5px]" lang="ar" dir="rtl">{c.current.body_ar}</p>}
        {c.current?.body_en && <p className="text-[13px]" lang="en" dir="ltr">{c.current.body_en}</p>}
      </div>
    );
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-card-2 p-2 text-[12px]" dir="auto">
      {JSON.stringify(c.row, null, 2)}
    </pre>
  );
}

function Article({ title, body, cut, lang, cite }: { title: string; body: string; cut: boolean; lang: "ar" | "en"; cite: React.ReactNode }) {
  return (
    <figure className="cand">
      <figcaption>{title}</figcaption>
      <blockquote className={(lang === "ar" ? "ar-classical text-[14px] leading-[1.9]" : "text-[12.5px] leading-relaxed") + " line-clamp-8 whitespace-pre-wrap"} lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
        {body}
        {cut && " …"}
      </blockquote>
      {cite}
    </figure>
  );
}

/** A topic's name as the workbench lists it, read by its id (P8.3b). */
function TopicName({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["editorial-entry", "topic", id], queryFn: () => getEntry("topic", id), staleTime: 5 * 60_000 });
  return (
    <span className="font-medium" lang="ar" dir="auto">
      {q.data?.target.label || id}
    </span>
  );
}

/** The board's work on a heading (P8.3b): its Arabic name (empty keeps a Quranpedia topic's own), an English name,
 * and its place — where its source puts it, at the top, or under a topic the board works on. */
function TopicForm({ page, value, onValue }: { page: EntryPage; value: Value; onValue: (v: Value) => void }) {
  const t = useTranslations("workbench");
  const [label, setLabel] = useState("");
  // "under a topic" chosen before one is picked
  const [picking, setPicking] = useState(false);
  const tg = page.target;
  const fromSource = tg.source_id === "quranpedia-topics";
  const placed = !!value.under && value.under !== "top";
  const place = placed || picking ? "under" : value.under === "top" || !fromSource ? "top" : "source";
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-[12px] text-t3">
        {t("topicNameAr")}
        <input className="field-input text-[15px]" value={value.name_ar} maxLength={200} onChange={(e) => onValue({ ...value, name_ar: e.target.value })} dir="rtl" lang="ar" placeholder={fromSource ? (tg.name_ar ?? "") : ""} />
        {fromSource && <span className="text-[11.5px]">{t("topicNameKeepHint", { name: tg.name_ar ?? "" })}</span>}
        {tg.source_id === "labeaume" && <span className="text-[11.5px]" lang="fr" dir="ltr">{tg.name_fr} — {tg.source_ref}</span>}
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-t3">
        {t("topicNameEn")}
        <input className="field-input" value={value.name_en} maxLength={200} onChange={(e) => onValue({ ...value, name_en: e.target.value })} dir="ltr" lang="en" />
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[12px] text-t3">{t("topicPlace")}</legend>
        <div className="flex flex-wrap gap-3 text-[12.5px]">
          {fromSource && (
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="topic-place"
                checked={place === "source"}
                onChange={() => {
                  setPicking(false);
                  onValue({ ...value, under: "" });
                }}
              />
              {t("topicWhereSource")}
            </label>
          )}
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="topic-place"
              checked={place === "top"}
              onChange={() => {
                setPicking(false);
                onValue({ ...value, under: fromSource ? "top" : "" });
              }}
            />
            {t("topicAtTop")}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="topic-place" checked={place === "under"} onChange={() => setPicking(true)} />
            {t("topicUnder")}
          </label>
        </div>
        {place === "under" && (
          <TopicPicker
            value={placed ? value.under : ""}
            label={label}
            exclude={String(tg.key)}
            onPick={(id, l) => {
              setLabel(l);
              onValue({ ...value, under: id });
            }}
          />
        )}
      </fieldset>
    </div>
  );
}

/** What the sources say of a heading: La Beaume's chapter as printed (cited in one click), where Quranpedia places
 * its topic, its sub-topics and first verses, QSAC's machine tags on them (a hint, never a name), and what the board
 * has placed under it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TopicCandidates({ c, cite }: { c: Record<string, any>; cite: (s: Source) => React.ReactNode }) {
  const t = useTranslations("workbench");
  const locale = useLocale();
  const none = !c.chapter && !c.chain?.length && !c.subtopics?.length && !c.verses?.length && !c.placed_here?.length;
  return (
    <div className="flex flex-col gap-3">
      {c.chapter && (
        <figure className="cand">
          <figcaption>{t("candChapter")}</figcaption>
          <blockquote className="text-[15px]" lang="fr" dir="ltr">
            {c.chapter.title_fr} — {c.chapter.ref}
          </blockquote>
          {cite({ work: "labeaume", ref: c.chapter.ref, quote: c.chapter.title_fr })}
        </figure>
      )}
      {c.chain?.length > 0 && (
        <div className="cand">
          <p className="cand-h">{t("candChain")}</p>
          <p className="text-[13.5px]" lang="ar">{(c.chain as { name_ar: string }[]).map((x) => x.name_ar).join(" › ")}</p>
        </div>
      )}
      {c.subtopics?.length > 0 && (
        <div className="cand">
          <p className="cand-h">{t("candSubtopics")}</p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
            {(c.subtopics as { id: string; name_ar: string; verse_count: number }[]).map((x) => (
              <li key={x.id} lang="ar">
                {x.name_ar} <span className="mono text-[11px] text-t3">{formatNumber(x.verse_count, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {c.verses?.length > 0 && (
        <div className="cand">
          <p className="cand-h">{t("candTopicVerses")}</p>
          <p className="mono text-[12px] text-t2">{(c.verses as string[]).map((k) => verseRef(k, locale)).join("، ")}</p>
        </div>
      )}
      {c.qsac?.length > 0 && (
        <div className="cand">
          <p className="cand-h">{t("candQsac")}</p>
          <ul className="flex flex-col gap-0.5 text-[12.5px]" dir="ltr" lang="en">
            {(c.qsac as { tag: string; category: string | null; verses: number }[]).map((x) => (
              <li key={x.tag}>
                {x.tag}
                {x.category && <span className="text-t3"> — {x.category}</span>} <span className="mono text-[11px] text-t3">{formatNumber(x.verses, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {c.placed_here?.length > 0 && (
        <div className="cand">
          <p className="cand-h">{t("candPlacedHere")}</p>
          <p className="text-[13px]" lang="ar">{(c.placed_here as { id: string; name: string }[]).map((x) => x.name).join("، ")}</p>
        </div>
      )}
      {none && <p className="text-[12.5px] text-t3">{t("candNone")}</p>}
    </div>
  );
}
