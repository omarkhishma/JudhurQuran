"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/store";
import { addNote, editNote, getHeat, getLesson, getMatrix, getMine, getNotes, getPack, lessonKeys, rangesLine, removeNote, sendNudge, type Cell, type Heat, type Layer, type LessonOut, type LessonNote } from "@/lib/classroom";
import { setFinished } from "@/lib/classroomSignals";
import { useIsClient } from "@/lib/client";
import { cnt, formatNumber, verseRef } from "@/lib/format";
import { getJSON } from "@/lib/reader/api";
import { SAJDA, splitFurniture } from "@/lib/reader/verseText";
import type { Verse, WordLite } from "@/lib/types";
import { LessonMap } from "./LessonMap";
import { NoteLine, useClassError, useFmt, useSurahNames } from "./shared";

const LAYERS: Layer[] = ["lookup", "note", "confirm", "struggle"];
// the matrix is by root, and a note is written on a verse, not a word: it has no root to sit under
const MATRIX_LAYERS: Layer[] = ["lookup", "confirm", "struggle"];
// how much is "more" differs by kind: looking a word up is common, a note or a mark is not (the legend says the steps)
const STEPS: Record<Layer, [number, number, number]> = { lookup: [1, 4, 9], note: [1, 2, 4], confirm: [1, 2, 4], struggle: [1, 2, 4] };
type Level = 0 | 1 | 2 | 3 | "few";
const levelOf = (n: number, layer: Layer): Level => {
  const [a, b, d] = STEPS[layer];
  return n >= d ? 3 : n >= b ? 2 : n >= a ? 1 : 0;
};
const level = (c: Cell | undefined, layer: Layer): Level => (!c ? 0 : "few" in c ? "few" : levelOf(c.total, layer));
const day = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

/** A count about a word or a verse, said in words: how many learners and how often, or that they were few. */
function useCellText() {
  const t = useTranslations("classroom");
  const locale = useLocale();
  return (c: Cell | undefined, layer: Layer, few: number) =>
    !c ? t("cellNone") : "few" in c ? t("cellFew", { few: formatNumber(few, locale) }) : `${t("learnersN", cnt(c.learners, locale))}${locale === "ar" ? "، " : ", "}${t(layer === "note" ? "notesN" : "timesN", cnt(c.total, locale))}`;
}

/**
 * A lesson (P9.2b; CLS-03…05, 08…21, 23, 24, Q04, Q05, H02, DEF-11). Its instructor sees the lesson's verses in the
 * mushaf's text with the class's heat under the words — never on the letters — one kind at a time, the legend
 * following the kind; a word's card with the class's numbers; the class's totals, the roots most looked up, who needs
 * a reminder (gently, named only by their own choice); the lesson notes; and the matrix of the learners who chose to
 * show their detail by the lesson's roots. A member reads the lesson, says when they finished it, reads the
 * instructor's notes, and sees what their own reader sent.
 */
export function LessonPage({ id }: { id: string }) {
  const t = useTranslations("classroom");
  const client = useIsClient();
  const session = useAccount((s) => s.session);
  const q = useQuery({ queryKey: ["lesson", id, session], queryFn: () => getLesson(id), enabled: client && !!session, retry: false });
  if (!client || (session && q.isPending)) return <div className="mx-auto my-6 h-64 w-full max-w-[1200px] animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!session)
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-start gap-3 px-4 py-10">
        <h1 className="text-[22px] font-semibold">{t("title")}</h1>
        <p className="text-[14px] text-t1">{t("signedOut")}</p>
        <Link href={`/signin?next=${encodeURIComponent(`/classroom/lesson/${id}`)}`} className="btn btn-primary">{t("signIn")}</Link>
      </div>
    );
  if (!q.data)
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-start gap-3 px-4 py-10">
        <h1 className="text-[22px] font-semibold">{t("title")}</h1>
        <p role="alert" className="text-[14px] text-t2">{t("lessonNotFound")}</p>
        <Link href="/classroom" className="btn">{t("backToClassroom")}</Link>
      </div>
    );
  return q.data.class?.role === "instructor" ? <TeachLesson lesson={q.data} /> : <LearnLesson lesson={q.data} />;
}

function Head({ lesson }: { lesson: LessonOut }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const names = useSurahNames();
  const fmt = useFmt();
  return (
    <header className="flex flex-col gap-1">
      <nav aria-label={t("breadcrumb")} className="text-[13px] text-t2">
        <Link href="/classroom" className="underline-offset-2 hover:underline">{t("title")}</Link>
        <span aria-hidden="true"> › </span>
        <Link href={`/classroom/${lesson.class_id}`} className="underline-offset-2 hover:underline" dir="auto">{lesson.class?.name}</Link>
      </nav>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[22px] font-semibold" dir="auto">{lesson.title}</h1>
        {!lesson.open && <span className="state-chip">{t("closed")}</span>}
        {lesson.class?.minors && <span className="state-chip">{t("minorsChip")}</span>}
      </div>
      <p className="text-[13px] text-t2">
        {rangesLine(lesson.ranges, names, fmt)} · {t("versesCount", cnt(lesson.verses, locale))}
        {lesson.due_at && ` · ${t("due", { day: day(lesson.due_at, locale) })}`}
      </p>
    </header>
  );
}

type LessonTab = "class" | "map";

/** The lesson's two views — how the class read it (a member: the lesson) and its map — kept in the address. */
function useLessonTab(): [LessonTab, (t: LessonTab) => void] {
  const sp = useSearchParams();
  const [tab, setTab] = useState<LessonTab>(sp.get("tab") === "map" ? "map" : "class");
  return [
    tab,
    (next) => {
      setTab(next);
      const u = new URL(window.location.href);
      if (next === "map") u.searchParams.set("tab", "map");
      else u.searchParams.delete("tab");
      window.history.replaceState(null, "", u);
    },
  ];
}

function LessonTabs({ tab, onTab, teach, pending }: { tab: LessonTab; onTab: (t: LessonTab) => void; teach: boolean; pending: number }) {
  const t = useTranslations("classroom");
  const fmt = useFmt();
  return (
    <div className="lesson-tabs" role="tablist" aria-label={t("lessonViews")}>
      {(["class", "map"] as const).map((x) => (
        <button key={x} type="button" role="tab" id={`lt-${x}`} aria-selected={tab === x} aria-controls="lesson-view" className="lesson-tab" onClick={() => onTab(x)}>
          {t(x === "map" ? "tabMap" : teach ? "tabClass" : "tabLesson")}
          {x === "map" && teach && pending > 0 && <span className="side-count" aria-label={t("pendingCount", { n: fmt(pending) })}>{fmt(pending)}</span>}
        </button>
      ))}
    </div>
  );
}

/** The lesson's verses, read in batches the API allows. */
function useLessonVerses(lesson: LessonOut, enabled = true) {
  return useQuery({
    queryKey: ["lesson-verses", JSON.stringify(lesson.ranges)],
    queryFn: async () => {
      const keys = lessonKeys(lesson.ranges);
      const out: Verse[] = [];
      for (let i = 0; i < keys.length; i += 50) out.push(...(await getJSON<{ data: Verse[] }>(`/verses?keys=${encodeURIComponent(keys.slice(i, i + 50).join(","))}`)).data);
      return out;
    },
    staleTime: Infinity,
    enabled,
  });
}
const wordsOf = (verses: Verse[] | undefined) => new Map((verses ?? []).flatMap((v) => v.words.map((w) => [w.location, w] as const)));

function TeachLesson({ lesson }: { lesson: LessonOut }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const [layer, setLayer] = useState<Layer>("lookup");
  const [view, setView] = useState<"text" | "matrix">("text");
  const [focus, setFocus] = useState<string | null>(null);
  const heat = useQuery({ queryKey: ["heat", lesson.id], queryFn: () => getHeat(lesson.id), refetchOnWindowFocus: true, refetchInterval: 60_000 });
  const verses = useLessonVerses(lesson);
  const h = heat.data;
  const words = wordsOf(verses.data);
  const shown: Layer = view === "matrix" && layer === "note" ? "lookup" : layer;
  const focusWord = focus ? words.get(focus) : undefined;
  const [tab, setTab] = useLessonTab();
  return (
    // the map's editor needs the room its header is made for
    <div className={"mx-auto flex w-full flex-col gap-5 px-4 py-6 " + (tab === "map" ? "max-w-[1600px]" : "max-w-[1200px]")}>
      <Head lesson={lesson} />
      <LessonTabs tab={tab} onTab={setTab} teach pending={lesson.pending} />
      {tab === "map" ? (
        <div id="lesson-view" role="tabpanel" aria-labelledby="lt-map">
          <LessonMap lesson={lesson} teach notes={<LessonNotes lesson={lesson} words={words} />} />
        </div>
      ) : (
        <div id="lesson-view" role="tabpanel" aria-labelledby="lt-class" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="flex min-w-0 flex-col gap-4" aria-labelledby="text-h">
            <h2 id="text-h" className="sr-only">{t("assignment")}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="seg-group" role="group" aria-label={t("view")}>
                {(["text", "matrix"] as const).map((v) => (
                  <button key={v} type="button" className="seg" aria-pressed={view === v} onClick={() => setView(v)}>
                    {t(`view_${v}`)}
                  </button>
                ))}
              </div>
              <div className="seg-group" role="group" aria-label={t("layer")}>
                {(view === "matrix" ? MATRIX_LAYERS : LAYERS).map((l) => (
                  <button key={l} type="button" className="seg" aria-pressed={shown === l} onClick={() => setLayer(l)}>
                    {t(`layer_${l}`)}
                  </button>
                ))}
              </div>
            </div>
            {h && <Legend layer={shown} few={h.few} matrix={view === "matrix"} />}
            {h && !h.floor_met && (
              <p className="rounded-lg border border-line bg-card-2 p-3 text-[13px] leading-relaxed text-t1" role="status">
                {t("floorNotMet", { floor: formatNumber(h.floor, locale), n: formatNumber(h.members, locale) })}
              </p>
            )}
            {heat.isError && <p role="alert" className="text-[13px] text-t2">{t("failed")}</p>}
            {view === "text" ? (
              verses.isPending ? (
                <span className="block h-48 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />
              ) : verses.isError ? (
                <p role="alert" className="text-[13px] text-t2">{t("failed")}</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {(verses.data ?? []).map((v) => (
                    <HeatVerse key={v.key} v={v} heat={h} layer={shown} focus={focus} onFocus={setFocus}>
                      {focusWord && h && focus?.startsWith(`${v.key}:`) && <FocusCard lessonId={lesson.id} word={focusWord} heat={h} onClose={() => setFocus(null)} />}
                    </HeatVerse>
                  ))}
                </div>
              )
            ) : (
              <MatrixView lesson={lesson} layer={shown} verses={verses.data} heat={h} />
            )}
          </section>
          <section className="flex flex-col gap-4" aria-label={t("classPanel")}>
            {h && <ClassPanel lessonId={lesson.id} heat={h} open={lesson.open} />}
            <LessonNotes lesson={lesson} words={words} />
            <p className="text-[12px] leading-relaxed text-t3">{t(h?.minors ? "panelFootMinors" : "panelFoot", { floor: formatNumber(h?.floor ?? 5, locale), few: formatNumber(h?.few ?? 3, locale) })}</p>
          </section>
        </div>
      )}
    </div>
  );
}

/** The legend follows the kind shown (DEF-11, CLS-05). */
function Legend({ layer, few, matrix }: { layer: Layer; few: number; matrix: boolean }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const [a, b, d] = STEPS[layer];
  const n = (x: number) => formatNumber(x, locale);
  const spans = [a === b - 1 ? n(a) : `${n(a)}–${n(b - 1)}`, b === d - 1 ? n(b) : `${n(b)}–${n(d - 1)}`, `${n(d)}+`];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-t2">
      <span>{t(matrix ? `legendMatrix_${layer}` : `legend_${layer}`)}</span>
      {spans.map((s, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="heat-swatch" data-heat={i + 1} aria-hidden="true" />
          <span dir="ltr">{s}</span>
        </span>
      ))}
      {!matrix && (
        <span className="flex items-center gap-1.5">
          <span className="heat-swatch" data-heat="few" aria-hidden="true" />
          {t("legendFew", { few: n(few) })}
        </span>
      )}
    </div>
  );
}

/** One verse in the mushaf's text, each word a button with the class's heat under it (never on its letters); a note
 * is written on a verse, so the notes' heat sits under the whole verse. */
function HeatVerse({ v, heat, layer, focus, onFocus, children }: { v: Verse; heat: Heat | undefined; layer: Layer; focus: string | null; onFocus: (loc: string | null) => void; children: ReactNode }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const say = useCellText();
  const few = heat?.few ?? 3;
  const verseCell = heat?.words[`${v.key}:0`]?.note;
  const layerName = t(`layer_${layer}`);
  return (
    <article className="flex flex-col gap-1" aria-labelledby={`v-${v.key}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 text-[11.5px] text-t3">
        <span id={`v-${v.key}`} className="mono" dir="ltr">{verseRef(v.key, locale)}</span>
        {layer === "note" && <span>{`${t("noteOnVerse")}: ${say(verseCell, "note", few)}`}</span>}
      </div>
      <p className="quran class-verse" dir="rtl" lang="ar" data-heat={layer === "note" ? level(verseCell, "note") || undefined : undefined}>
        {v.hizb_mark && <span className="hizb-mark" aria-hidden="true">{"۞ "}</span>}
        {v.tokens.map((tk, i) => {
          const loc = `${v.key}:${tk.word_from}`;
          const cell = layer === "note" ? undefined : heat?.words[loc]?.[layer];
          const lv = level(cell, layer);
          const { word, sajda } = splitFurniture(tk.text);
          return (
            <Fragment key={tk.position}>
              <button
                type="button"
                className="heat-w"
                data-heat={lv || undefined}
                data-w={loc}
                aria-pressed={focus === loc}
                aria-label={layer === "note" ? word : `${word} — ${layerName}: ${say(cell, layer, few)}`}
                onClick={() => onFocus(focus === loc ? null : loc)}
              >
                {word}
              </button>
              {sajda && <span className="sajda-mark" aria-hidden="true">{SAJDA}</span>}
              {i < v.tokens.length - 1 ? " " : null}
            </Fragment>
          );
        })}{" "}
        <span className="ayah-num" aria-hidden="true">
          {v.number_text}
        </span>
      </p>
      {children}
    </article>
  );
}

/** A word's card (CLS-13…15): the class's numbers for each kind, its lemma and root, and a place in the lesson notes. */
function FocusCard({ lessonId, word, heat, onClose }: { lessonId: string; word: WordLite; heat: Heat; onClose: () => void }) {
  const t = useTranslations("classroom");
  const fail = useClassError();
  const locale = useLocale();
  const qc = useQueryClient();
  const say = useCellText();
  const notes = useQuery({ queryKey: ["lesson-notes", lessonId], queryFn: () => getNotes(lessonId) });
  const [said, setSaid] = useState("");
  const inNotes = notes.data?.data.some((n) => n.location === word.location);
  const cells = heat.words[word.location] ?? {};
  const verse = word.location.split(":").slice(0, 2).join(":");
  return (
    <section className="focus-card flex flex-col gap-2 rounded-xl border border-line-2 bg-card p-4" aria-label={t("focusCard", { word: word.text_uthmani })} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="flex items-start justify-between gap-2">
        <p className="quran text-[28px] leading-[1.5]" lang="ar" dir="rtl">{word.text_uthmani}</p>
        <button type="button" className="icon-btn" aria-label={t("closeCard")} onClick={onClose}>×</button>
      </div>
      {!heat.floor_met ? (
        <p className="text-[12.5px] text-t3">{t("focusFloor", { floor: formatNumber(heat.floor, locale) })}</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
          {LAYERS.map((l) => (
            <Fragment key={l}>
              <dt className="text-t3">{l === "note" ? t("noteOnVerse") : t(`layer_${l}`)}</dt>
              <dd className="text-t1">{say(l === "note" ? heat.words[`${verse}:0`]?.note : cells[l], l, heat.few)}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      <p className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-t2">
        {word.lemma && <span className="ar-classical text-[16px]" lang="ar">{word.lemma}</span>}
        {word.root ? (
          <Link href={`/roots/${encodeURIComponent(word.root)}`} className="underline-offset-2 hover:underline">
            {t("rootOf")} <span className="ar-classical text-[16px]" lang="ar">{[...word.root].join(" ")}</span>
          </Link>
        ) : (
          <span>{t("noRoot")}</span>
        )}
        {word.translit && <span className="mono text-[11.5px]" dir="ltr">{word.translit}</span>}
        <Link href={`/quran/${verse.replace(":", "/")}`} className="underline-offset-2 hover:underline">{t("inReader")}</Link>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn"
          disabled={inNotes}
          onClick={async () => {
            try {
              await addNote(lessonId, { location: word.location });
              await qc.invalidateQueries({ queryKey: ["lesson-notes", lessonId] });
              setSaid(t("addedToNotes"));
            } catch (e) {
              setSaid(fail(e));
            }
          }}
        >
          {t(inNotes ? "inLessonNotes" : "addToLessonNotes")}
        </button>
        <span role="status" className="text-[12px] text-t2">{said}</span>
      </div>
    </section>
  );
}

/** The class's totals (CLS-16, 17, 21, 23): computed, never sample numbers; who needs a reminder, gently and
 * privately — a notice on their own page, named here only by their choice. */
function ClassPanel({ lessonId, heat, open }: { lessonId: string; heat: Heat; open: boolean }) {
  const t = useTranslations("classroom");
  const fail = useClassError();
  const locale = useLocale();
  const qc = useQueryClient();
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const n = (x: number) => formatNumber(x, locale);
  const max = Math.max(1, ...heat.roots.map((r) => ("total" in r ? r.total : 0)));
  const names = (xs: (string | null)[]) => xs.map((x) => x ?? t("aReader")).join(locale === "ar" ? "، " : ", ");
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4" aria-labelledby="panel-h">
      <h2 id="panel-h" className="label-caps">{`${t("classPanelTitle")} · ${t("membersCount", cnt(heat.members, locale))}`}</h2>
      <div className="grid grid-cols-3 gap-2">
        <Tile label={t("tileOpened")} value={n(heat.opened)} />
        <Tile label={t("tileFinished")} value={n(heat.finished)} />
        <Tile label={t("tileMinutes")} value={heat.median_minutes == null ? "—" : n(Math.round(heat.median_minutes))} />
      </div>
      <section className="flex flex-col gap-1.5" aria-labelledby="roots-h">
        <h3 id="roots-h" className="label-caps">{t("topRoots")}</h3>
        {!heat.floor_met ? (
          <p className="text-[12.5px] text-t3">{t("topRootsFloor", { floor: n(heat.floor) })}</p>
        ) : heat.roots.length ? (
          <ul className="flex flex-col gap-1">
            {heat.roots.map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                <Link href={`/roots/${encodeURIComponent(r.key)}`} className="ar-classical w-[4.5rem] shrink-0 text-[17px] text-root hover:underline" lang="ar">{r.spaced}</Link>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-card-3" aria-hidden="true">
                  {"total" in r && <span className="absolute inset-y-0 start-0 rounded-full bg-root" style={{ width: `${Math.max(4, (r.total / max) * 100)}%` }} />}
                </span>
                <span className="mono w-12 shrink-0 text-end text-[11.5px] text-t2">{"total" in r ? n(r.total) : t("cellFewShort")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-t3">{t("topRootsNone")}</p>
        )}
      </section>
      <section className="flex flex-col gap-1.5" aria-labelledby="nudge-h">
        <h3 id="nudge-h" className="label-caps">{t("needsNudge")}</h3>
        <ul className="flex flex-col gap-1.5 text-[12.5px] text-t1">
          <li className="flex gap-2">
            <span className="nudge-dot is-start" aria-hidden="true" />
            <span>
              {t("notStarted", cnt(heat.not_started.count, locale))}
              {heat.not_started.named.length > 0 && <span className="block text-t2" dir="auto">{names(heat.not_started.named)}</span>}
            </span>
          </li>
          {heat.quick.count > 0 && (
            <li className="flex gap-2">
              <span className="nudge-dot is-quick" aria-hidden="true" />
              <span>
                {t("quickFinish", cnt(heat.quick.count, locale))}
                {heat.quick.named.length > 0 && <span className="block text-t2" dir="auto">{names(heat.quick.named)}</span>}
              </span>
            </li>
          )}
        </ul>
        {open && heat.not_started.count > 0 && (
          <button
            type="button"
            className="btn self-start"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await sendNudge(lessonId);
                setSaid(t("nudgeSent", cnt(r.sent, locale)));
                await qc.invalidateQueries({ queryKey: ["heat", lessonId] });
              } catch (e) {
                setSaid(fail(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("nudge")}
          </button>
        )}
        <p className="text-[11.5px] leading-relaxed text-t3">{t("nudgeHint")}</p>
        {heat.nudges.sent > 0 && <p className="text-[12px] text-t2">{t("nudgesSeen", { seen: n(heat.nudges.seen), sent: n(heat.nudges.sent) })}</p>}
        <p role="status" className="text-[12px] text-t2">{said}</p>
      </section>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-line px-2.5 py-2">
      <span className="text-[19px] font-semibold leading-tight text-t1">{value}</span>
      <span className="text-[11px] leading-tight text-t3">{label}</span>
    </div>
  );
}

/** The lesson notes (CLS-19, 20): a word, a root or a line; reworded, moved, removed. They travel with the lesson's
 * file, so the class reads them too. */
function LessonNotes({ lesson, words }: { lesson: LessonOut; words: Map<string, WordLite> }) {
  const t = useTranslations("classroom");
  const fail = useClassError();
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["lesson-notes", lesson.id], queryFn: () => getNotes(lesson.id) });
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [said, setSaid] = useState("");
  const apply = async (p: Promise<unknown>, done?: string) => {
    try {
      await p;
      await qc.invalidateQueries({ queryKey: ["lesson-notes", lesson.id] });
      setSaid(done ?? "");
      return true;
    } catch (e) {
      setSaid(fail(e));
      return false;
    }
  };
  const notes: LessonNote[] = q.data?.data ?? [];
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4" aria-labelledby="notes-h">
      <h2 id="notes-h" className="label-caps">
        {t("lessonNotesTeach")}
        {lesson.due_at && ` · ${day(lesson.due_at, locale)}`}
      </h2>
      <p className="text-[12px] leading-relaxed text-t3">{t(notes.length ? "lessonNotesLead" : "lessonNotesEmpty")}</p>
      {notes.length > 0 && (
        <ol className="flex flex-col divide-y divide-line">
          {notes.map((n, i) => (
            <li key={n.id} className="flex flex-col gap-1 py-1.5 text-[13px]">
              {editing?.id === n.id ? (
                <form
                  className="flex gap-1.5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await apply(editNote(n.id, { text: editing.text.trim() }), t("noteSaved"))) setEditing(null);
                  }}
                >
                  <input className="field-input min-w-0 flex-1" value={editing.text} maxLength={1000} onChange={(e) => setEditing({ id: n.id, text: e.target.value })} aria-label={t("noteText")} dir="auto" autoFocus />
                  <button type="submit" className="btn">{t("save")}</button>
                </form>
              ) : (
                <NoteLine n={n} word={n.location ? words.get(n.location)?.text_uthmani : undefined} />
              )}
              <div className="flex items-center gap-1">
                <button type="button" className="note-act" onClick={() => setEditing(editing?.id === n.id ? null : { id: n.id, text: n.text })}>{t(editing?.id === n.id ? "cancel" : "noteEdit")}</button>
                <button type="button" className="note-act" disabled={i === 0} onClick={() => void apply(editNote(n.id, { move: -1 }))} aria-label={t("noteUp")}>↑</button>
                <button type="button" className="note-act" disabled={i === notes.length - 1} onClick={() => void apply(editNote(n.id, { move: 1 }))} aria-label={t("noteDown")}>↓</button>
                <button type="button" className="note-act" onClick={() => void apply(removeNote(n.id), t("noteRemoved"))}>{t("noteRemove")}</button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <form
        className="flex gap-1.5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (text.trim() && (await apply(addNote(lesson.id, { text: text.trim() }), t("noteSaved")))) setText("");
        }}
      >
        <input className="field-input min-w-0 flex-1" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={t("noteAddHint")} aria-label={t("noteAdd")} dir="auto" />
        <button type="submit" className="btn" disabled={!text.trim()}>{t("add")}</button>
      </form>
      <p role="status" className="text-[12px] text-t2">{said}</p>
    </section>
  );
}

/** The class by the lesson's roots (D13's matrix): a row for each learner who chose to show their detail, the others
 * together in one row; tight cells, a cell focusing its learner and root. */
function MatrixView({ lesson, layer, verses, heat }: { lesson: LessonOut; layer: Layer; verses: Verse[] | undefined; heat: Heat | undefined }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const say = useCellText();
  const q = useQuery({ queryKey: ["matrix", lesson.id, layer], queryFn: () => getMatrix(lesson.id, layer), refetchOnWindowFocus: true });
  const [pair, setPair] = useState<{ row: number; key: string } | null>(null);
  if (q.isPending) return <span className="block h-40 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  const m = q.data;
  if (!m) return <p role="alert" className="text-[13px] text-t2">{t("failed")}</p>;
  if (!m.floor_met) return null;
  const all = [...m.rows.map((r) => ({ name: r.name ?? t("aReader"), cells: r.cells, of: 1 })), ...(m.others ? [{ name: t("othersRow", { n: formatNumber(m.others.count, locale) }), cells: m.others.cells, of: m.others.count }] : [])];
  if (!m.columns.length) return <p className="text-[13px] text-t3">{t("matrixNoRoots")}</p>;
  const focused = pair ? all[pair.row] : undefined;
  const col = pair ? m.columns.find((c) => c.key === pair.key) : undefined;
  const rootWords = col ? (verses ?? []).flatMap((v) => v.words.filter((w) => w.root === col.key)) : [];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] leading-relaxed text-t2">{t(heat?.minors ? "matrixLeadMinors" : "matrixLead")}</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="class-matrix">
          <caption className="sr-only">{t("matrixCaption", { layer: t(`layer_${layer}`) })}</caption>
          <thead>
            <tr>
              <th scope="col">{t("learner")}</th>
              {m.columns.map((c) => (
                <th key={c.key} scope="col" className="ar-classical" lang="ar">{c.spaced}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {all.map((r, ri) => (
              <tr key={ri} className={r.of > 1 ? "is-others" : undefined}>
                <th scope="row" dir="auto">{r.name}</th>
                {m.columns.map((c) => {
                  const v = r.cells[c.key] ?? 0;
                  const on = pair?.row === ri && pair.key === c.key;
                  return (
                    <td key={c.key} data-heat={levelOf(Math.ceil(v / r.of), layer) || undefined}>
                      <button type="button" aria-pressed={on} aria-label={`${r.name} · ${c.spaced}: ${formatNumber(v, locale)}`} onClick={() => setPair(on ? null : { row: ri, key: c.key })}>
                        {v ? formatNumber(v, locale) : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {m.others_few && <p className="text-[12px] text-t3">{t("othersFew", { few: formatNumber(heat?.few ?? 3, locale) })}</p>}
      {focused && col && (
        <section className="flex flex-col gap-2 rounded-xl border border-line-2 bg-card p-4" aria-label={t("pairCard")}>
          <p className="text-[14px] text-t1">
            <span dir="auto">{focused.name}</span> · <span className="ar-classical text-[17px]" lang="ar">{col.spaced}</span> · {t(`layer_${layer}`)}:{" "}
            <span className="font-semibold">{formatNumber(focused.cells[col.key] ?? 0, locale)}</span>
          </p>
          {rootWords.length > 0 ? (
            <>
              <p className="text-[12px] text-t3">{t("pairWords")}</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {rootWords.map((w) => (
                  <li key={w.location} className="flex items-baseline gap-1.5">
                    <span className="quran text-[20px]" lang="ar" dir="rtl">{w.text_uthmani}</span>
                    <span className="mono text-[11px] text-t3" dir="ltr">{verseRef(w.location, locale)}</span>
                    {heat && <span className="text-[11.5px] text-t2">{say(heat.words[w.location]?.[layer], layer, heat.few)}</span>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[12px] text-t3">{t("pairNoWords")}</p>
          )}
          <Link href={`/roots/${encodeURIComponent(col.key)}`} className="self-start text-[12.5px] underline-offset-2 hover:underline">{t("openRoot")}</Link>
        </section>
      )}
    </div>
  );
}

/** A member's lesson: where to read it, their own word that they finished, a reminder seen, the instructor's notes,
 * and what their own reader sent — a member may always see what is kept of them. */
function LearnLesson({ lesson }: { lesson: LessonOut }) {
  const t = useTranslations("classroom");
  const fail = useClassError();
  const locale = useLocale();
  const qc = useQueryClient();
  const names = useSurahNames();
  const fmt = useFmt();
  const mine = useQuery({ queryKey: ["lesson-mine", lesson.id], queryFn: () => getMine(lesson.id) });
  const pack = useQuery({ queryKey: ["lesson-pack", lesson.id], queryFn: () => getPack(lesson.id) });
  const verses = useLessonVerses(lesson, !!mine.data?.counts.length);
  const words = wordsOf(verses.data);
  const [said, setSaid] = useState("");
  const done = !!lesson.mine?.finished_on;
  const [tab, setTab] = useLessonTab();
  const instructorNotes = pack.data?.notes.length ? (
    <ul className="flex flex-col gap-1.5 text-[13.5px] text-t1">
      {pack.data.notes.map((n, i) => (
        <li key={i}>
          <NoteLine n={n} />
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-[12.5px] text-t3">{t("lessonNotesNoneMember")}</p>
  );
  if (tab === "map")
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-6">
        <Head lesson={lesson} />
        <LessonTabs tab={tab} onTab={setTab} teach={false} pending={0} />
        <div id="lesson-view" role="tabpanel" aria-labelledby="lt-map">
          <LessonMap lesson={lesson} teach={false} notes={instructorNotes} />
        </div>
      </div>
    );
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-4 py-6">
      <Head lesson={lesson} />
      <LessonTabs tab={tab} onTab={setTab} teach={false} pending={0} />
      <div id="lesson-view" role="tabpanel" aria-labelledby="lt-class" className="flex flex-col gap-5">
        {lesson.mine?.nudged && <p className="rounded-lg border border-line bg-card-2 p-3 text-[13px] text-t1">{t("nudgedNote")}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {lesson.ranges.map((r, i) => (
            <Link key={i} href={`/quran/${r.surah}/${r.from}`} className="btn btn-primary">{t("readRange", { range: rangesLine([r], names, fmt) })}</Link>
          ))}
          {lesson.open && (
            <button
              type="button"
              className="btn"
              aria-pressed={done}
              onClick={async () => {
                try {
                  await setFinished(lesson.id, !done);
                  await qc.invalidateQueries({ queryKey: ["lesson", lesson.id] });
                  setSaid(t(done ? "unfinishedSaid" : "finishedSaid"));
                } catch (e) {
                  setSaid(fail(e));
                }
              }}
            >
              {t("markFinished")}
            </button>
          )}
          {done && <span className="state-chip is-approved">{t("finished")}</span>}
          <span role="status" className="text-[12.5px] text-t2">{said}</span>
        </div>
        {lesson.roots.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="label-caps">{t("roots")}</span>
            {lesson.roots.map((r) => (
              <Link key={r.key} href={`/roots/${encodeURIComponent(r.key)}`} className="chip ar-classical text-[15px]" lang="ar">{r.spaced}</Link>
            ))}
          </div>
        )}
        {pack.data && pack.data.notes.length > 0 && (
          <section aria-labelledby="inotes-h" className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
            <h2 id="inotes-h" className="text-[15px] font-semibold">{t("lessonNotes")}</h2>
            {instructorNotes}
          </section>
        )}
        <section aria-labelledby="mine-h" className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
          <h2 id="mine-h" className="text-[15px] font-semibold">{t("mineTitle")}</h2>
          <p className="text-[12.5px] leading-relaxed text-t2">{t(lesson.class?.minors ? "mineLeadMinors" : "mineLead")}</p>
          {mine.isPending ? (
            <span className="block h-10 animate-pulse rounded-lg bg-card-2" aria-hidden="true" />
          ) : mine.data?.counts.length ? (
            <table className="mine-table text-[13px]">
              <caption className="sr-only">{t("mineTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("mineWhere")}</th>
                  <th scope="col">{t("mineKind")}</th>
                  <th scope="col">{t("mineCount")}</th>
                </tr>
              </thead>
              <tbody>
                {mine.data.counts.map((c, i) => {
                  const verse = c.location.endsWith(":0");
                  const w = verse ? undefined : words.get(c.location);
                  return (
                    <tr key={i}>
                      <td>
                        {w && <span className="quran me-2 text-[18px]" lang="ar" dir="rtl">{w.text_uthmani}</span>}
                        <span className="mono text-[11.5px] text-t3" dir="ltr">{verseRef(verse ? c.location.slice(0, -2) : c.location, locale)}</span>
                      </td>
                      <td>{verse && c.kind === "note" ? t("noteOnVerse") : t(`layer_${c.kind}`)}</td>
                      <td className="mono">{formatNumber(c.n, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-[12.5px] text-t3">{t("mineNone")}</p>
          )}
          <p className="text-[12.5px] text-t2">
            {t("mineMinutes", { n: formatNumber(lesson.mine?.minutes ?? 0, locale) })}
            {lesson.mine?.opened_on && ` · ${t("mineOpened", { day: day(lesson.mine.opened_on, locale) })}`}
          </p>
          <Link href={`/classroom/${lesson.class_id}`} className="self-start text-[12.5px] underline-offset-2 hover:underline">{t("mineChoices")}</Link>
        </section>
      </div>
    </div>
  );
}
