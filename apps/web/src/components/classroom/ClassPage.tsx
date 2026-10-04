"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/store";
import { addLesson, copyLesson, deleteClass, deleteLesson, getClass, getClasses, getPack, leaveClass, newCode, rangesLine, removeMember, setDetail, updateClass, type ClassOut, type LessonOut, type Range } from "@/lib/classroom";
import { useIsClient } from "@/lib/client";
import { setFinished } from "@/lib/classroomSignals";
import { cnt } from "@/lib/format";
import { ConsentText, useClassError, useFmt, useSurahNames, useSurahs } from "./shared";

const FLOOR = 5;
// a due date is the end of its day in UTC: read in UTC, it is the day the instructor chose wherever the reader is
const day = (iso: string | null, locale: string) => (iso ? new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" }) : null);

/**
 * A class (P9.1; CLS-02, 22, 26, Q02, Q07, H03): its lessons — verse ranges of the mushaf and roots, each opening the
 * reader where it starts, each a file to take away — and, for its instructor, the join link, the lesson builder, the
 * roster with who chose to show their detail, and the class's settings; for a member, their own choice and the way
 * out, which takes everything the class held of them.
 */
export function ClassPage({ id }: { id: string }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const fmt = useFmt();
  const client = useIsClient();
  const session = useAccount((s) => s.session);
  const q = useQuery({ queryKey: ["class", id, session], queryFn: () => getClass(id), enabled: client && !!session, retry: false, refetchOnWindowFocus: true });
  if (!client) return <div className="mx-auto h-64 max-w-[960px] animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!session)
    return (
      <div className="mx-auto flex max-w-[720px] flex-col items-start gap-3 px-4 py-10">
        <p className="text-[14px] text-t1">{t("signedOut")}</p>
        <Link href={`/signin?next=${encodeURIComponent(`/classroom/${id}`)}`} className="btn btn-primary">{t("signIn")}</Link>
      </div>
    );
  if (q.isPending) return <div className="mx-auto h-64 max-w-[960px] animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  if (!q.data) return <p role="alert" className="mx-auto max-w-[720px] px-4 py-10 text-[14px] text-t2">{t("classNotFound")}</p>;
  const c = q.data;
  const teach = c.role === "instructor";
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-8">
      <nav aria-label={t("breadcrumb")}>
        <Link href="/classroom" className="text-[13px] text-t2 underline-offset-2 hover:underline">{t("title")}</Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="flex flex-wrap items-center gap-2 text-[24px] font-semibold" dir="auto">
          {c.name}
          {c.minors && <span className="state-chip text-[12px]">{t("minorsChip")}</span>}
          {c.archived_at && <span className="state-chip text-[12px]">{t("archivedChip")}</span>}
        </h1>
        <p className="text-[13px] text-t2">
          {teach ? t("membersCount", cnt(c.members, locale)) : t("taughtBy", { name: c.instructor.name ?? t("anInstructor") })}
          {teach && c.members < FLOOR && <span className="text-t3"> · {t("belowFloor", { floor: fmt(FLOOR) })}</span>}
        </p>
      </header>
      {teach && <JoinLink c={c} />}
      <section aria-labelledby="lessons-h" className="flex flex-col gap-3">
        <h2 id="lessons-h" className="text-[17px] font-semibold">{t("lessons")}</h2>
        {c.lessons?.length ? (
          <ul className="flex flex-col gap-3">
            {c.lessons.map((l) => (
              <LessonRow key={l.id} lesson={l} teach={teach} />
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-t3">{t(teach ? "lessonsNoneTeach" : "lessonsNone")}</p>
        )}
        {teach && !c.archived_at && <LessonBuilder classId={c.id} />}
      </section>
      {teach ? <Roster c={c} /> : <MySettings c={c} />}
      {teach && <ClassSettings c={c} />}
    </div>
  );
}

/** The link learners join by, to copy; a new one retires it (members stay). */
function JoinLink({ c }: { c: ClassOut }) {
  const t = useTranslations("classroom");
  const qc = useQueryClient();
  const [said, setSaid] = useState("");
  const url = typeof window !== "undefined" ? `${window.location.origin}/classroom/join/${c.join_code}` : "";
  return (
    <section aria-labelledby="link-h" className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
      <h2 id="link-h" className="text-[14px] font-semibold">{t("joinLink")}</h2>
      <p className="text-[12.5px] leading-relaxed text-t2">{t("joinLinkLead")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input className="field-input min-w-0 flex-1" readOnly value={url} aria-label={t("joinLink")} dir="ltr" onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setSaid(t("copied"));
            } catch {
              setSaid(t("copyFailed"));
            }
          }}
        >
          {t("copy")}
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await newCode(c.id);
            await qc.invalidateQueries({ queryKey: ["class", c.id] });
            setSaid(t("newLinkMade"));
          }}
        >
          {t("newLink")}
        </button>
      </div>
      <p role="status" className="text-[12.5px] text-t2">{said}</p>
    </section>
  );
}

function LessonRow({ lesson, teach }: { lesson: LessonOut; teach: boolean }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const qc = useQueryClient();
  const names = useSurahNames();
  const fmt = useFmt();
  const [confirm, setConfirm] = useState(false);
  async function download() {
    const p = await getPack(lesson.id);
    const a = document.createElement("a");
    const href = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }));
    a.href = href;
    a.download = `${t("packFileName")}-${lesson.title.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-[16px] font-semibold" dir="auto">
          <Link href={`/classroom/lesson/${lesson.id}`} className="underline-offset-2 hover:underline">{lesson.title}</Link>
        </h3>
        <span className="text-[12.5px] text-t3">{t("versesCount", cnt(lesson.verses, locale))}</span>
        {lesson.due_at && <span className="text-[12.5px] text-t3">· {t("due", { day: day(lesson.due_at, locale) ?? "" })}</span>}
        {!lesson.open && <span className="state-chip">{t("closed")}</span>}
        {lesson.mine?.finished_on && <span className="state-chip is-approved">{t("finished")}</span>}
        {lesson.mine?.nudged && <span className="state-chip is-review">{t("nudged")}</span>}
        {lesson.map && (
          <Link href={`/classroom/lesson/${lesson.id}?tab=map`} className="state-chip hover:underline">
            {t("mapChip")}
          </Link>
        )}
        {teach && lesson.pending > 0 && <span className="state-chip is-review">{t("mapPendingChip", { n: fmt(lesson.pending) })}</span>}
      </div>
      <p className="text-[14px] text-t1">{rangesLine(lesson.ranges, names, fmt)}</p>
      {lesson.roots.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label-caps">{t("roots")}</span>
          {lesson.roots.map((r) => (
            <Link key={r.key} href={`/roots/${encodeURIComponent(r.key)}`} className="chip ar-classical text-[15px]" lang="ar">{r.spaced}</Link>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {lesson.ranges.map((r, i) => (
          <Link key={i} href={`/quran/${r.surah}/${r.from}`} className="btn">{t("readRange", { range: rangesLine([r], names, fmt) })}</Link>
        ))}
        {teach && <Link href={`/classroom/lesson/${lesson.id}`} className="btn btn-primary">{t("classView")}</Link>}
        <button type="button" className="btn" onClick={() => void download()}>{t("packDownload")}</button>
        {!teach && lesson.open && (
          // the member's own word that they finished (P9.2a)
          <button
            type="button"
            className="btn"
            aria-pressed={!!lesson.mine?.finished_on}
            onClick={async () => {
              await setFinished(lesson.id, !lesson.mine?.finished_on);
              await qc.invalidateQueries({ queryKey: ["class", lesson.class_id] });
            }}
          >
            {t("markFinished")}
          </button>
        )}
        {teach &&
          (confirm ? (
            <button
              type="button"
              className="btn text-amber"
              onClick={async () => {
                await deleteLesson(lesson.id);
                await qc.invalidateQueries({ queryKey: ["class", lesson.class_id] });
              }}
            >
              {t("deleteLessonConfirm")}
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirm(true)}>{t("deleteLesson")}</button>
          ))}
      </div>
      {teach && <CopyLesson lesson={lesson} />}
    </li>
  );
}

/** The same lesson for another circle (B46): copied into another class of the instructor's — its verses, roots, due
 * date and notes, nothing of any member. Offered only when there is another open class to copy into. */
function CopyLesson({ lesson }: { lesson: LessonOut }) {
  const t = useTranslations("classroom");
  const fail = useClassError();
  const qc = useQueryClient();
  const classes = useQuery({ queryKey: ["classes"], queryFn: getClasses, staleTime: 60_000 });
  const others = (classes.data?.teaching ?? []).filter((c) => c.id !== lesson.class_id && !c.archived_at);
  const [to, setTo] = useState("");
  const [said, setSaid] = useState<ReactNode>("");
  if (!others.length) return null;
  const target = others.find((c) => c.id === to) ?? others[0];
  return (
    <form
      className="flex flex-wrap items-center gap-2 border-t border-line pt-2 text-[12.5px]"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await copyLesson(lesson.id, target.id);
          await qc.invalidateQueries({ queryKey: ["class", target.id] });
          setSaid(
            <>
              {t("copiedTo", { name: target.name })} <Link href={`/classroom/${target.id}`} className="underline underline-offset-2">{t("openClass")}</Link>
            </>,
          );
        } catch (err) {
          setSaid(fail(err));
        }
      }}
    >
      <label className="flex items-center gap-2 text-t2">
        {t("copyTo")}
        <select className="field-input py-1 text-[12.5px]" value={target.id} onChange={(e) => setTo(e.target.value)}>
          {others.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn text-[12.5px]">{t("copyLesson")}</button>
      <span role="status" className="text-t2">{said}</span>
    </form>
  );
}

/** A lesson: its title, one to ten ranges of verses, the roots it is about, a due date. The server checks each range
 * against the mushaf and each root against the corpus, and says what it refused. */
function LessonBuilder({ classId }: { classId: string }) {
  const t = useTranslations("classroom");
  const fail = useClassError();
  const qc = useQueryClient();
  const surahs = useSurahs().data?.data ?? [];
  const fmt = useFmt();
  const locale = useLocale();
  const [title, setTitle] = useState("");
  const [ranges, setRanges] = useState<Range[]>([{ surah: 1, from: 1, to: 7 }]);
  const [roots, setRoots] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const max = (s: number) => surahs.find((x) => x.number === s)?.verse_count ?? 286;
  const put = (i: number, r: Partial<Range>) =>
    setRanges((rs) =>
      rs.map((x, j) => {
        if (j !== i) return x;
        const n = { ...x, ...r };
        const top = max(n.surah);
        const from = Math.min(Math.max(1, n.from), top);
        return { surah: n.surah, from, to: Math.min(Math.max(from, n.to), top) };
      }),
    );
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4"
      aria-labelledby="builder-h"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setSaid("");
        try {
          const keys = roots.split(/[،,؛;\n]+/).map((x) => x.replace(/\s+/g, "")).filter(Boolean);
          await addLesson(classId, { title: title.trim(), ranges, roots: keys, due: due || null });
          setTitle("");
          setRoots("");
          setDue("");
          setRanges([{ surah: 1, from: 1, to: 7 }]);
          setSaid(t("lessonAdded"));
          await qc.invalidateQueries({ queryKey: ["class", classId] });
        } catch (err) {
          setSaid(fail(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 id="builder-h" className="text-[14px] font-semibold">{t("newLesson")}</h3>
      <label className="flex flex-col gap-1 text-[12.5px] text-t2">
        {t("lessonTitle")}
        <input className="field-input" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} dir="auto" required />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[12.5px] text-t2">{t("ranges")}</legend>
        {ranges.map((r, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[12px] text-t3">
              {t("surah")}
              <select className="field-input" value={r.surah} onChange={(e) => put(i, { surah: Number(e.target.value), from: 1, to: max(Number(e.target.value)) })}>
                {surahs.map((s) => (
                  <option key={s.number} value={s.number}>{`${fmt(s.number)}. ${locale === "ar" ? s.name_ar : s.name_translit}`}</option>
                ))}
              </select>
            </label>
            <label className="flex w-24 flex-col gap-1 text-[12px] text-t3">
              {t("fromVerse")}
              <input className="field-input" type="number" min={1} max={max(r.surah)} value={r.from} onChange={(e) => put(i, { from: Number(e.target.value) })} />
            </label>
            <label className="flex w-24 flex-col gap-1 text-[12px] text-t3">
              {t("toVerse")}
              <input className="field-input" type="number" min={r.from} max={max(r.surah)} value={r.to} onChange={(e) => put(i, { to: Number(e.target.value) })} />
            </label>
            {ranges.length > 1 && (
              <button type="button" className="btn" onClick={() => setRanges((rs) => rs.filter((_, j) => j !== i))} aria-label={t("removeRange")}>×</button>
            )}
          </div>
        ))}
        {ranges.length < 10 && (
          <button type="button" className="btn self-start text-[12.5px]" onClick={() => setRanges((rs) => [...rs, { surah: 1, from: 1, to: 7 }])}>{t("addRange")}</button>
        )}
      </fieldset>
      <label className="flex flex-col gap-1 text-[12.5px] text-t2">
        {t("lessonRoots")}
        <input className="field-input ar-classical text-[16px]" value={roots} onChange={(e) => setRoots(e.target.value)} placeholder={t("lessonRootsHint")} lang="ar" dir="rtl" />
      </label>
      <label className="flex w-48 flex-col gap-1 text-[12.5px] text-t2">
        {t("dueDate")}
        <input className="field-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>{t("addLesson")}</button>
        <span role="status" className="text-[12.5px] text-t2">{said}</span>
      </div>
    </form>
  );
}

/** Who joined, when, and who chose to show their detail — removed by the instructor with what the class held. */
function Roster({ c }: { c: ClassOut }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  const qc = useQueryClient();
  const [asked, setAsked] = useState<string | null>(null);
  return (
    <section aria-labelledby="roster-h" className="flex flex-col gap-3">
      <h2 id="roster-h" className="text-[17px] font-semibold">{t("roster")}</h2>
      <p className="text-[12.5px] leading-relaxed text-t3">{t(c.minors ? "rosterLeadMinors" : "rosterLead")}</p>
      {c.roster?.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-card">
          {c.roster.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <span className="min-w-0 flex-1 text-[14px] text-t1" dir="auto">{m.name ?? t("aReader")}</span>
              <span className="text-[12px] text-t3">{t("joinedOn", { day: day(m.joined_at, locale) ?? "" })}</span>
              {m.detail_opt_in && <span className="state-chip">{t("showsDetail")}</span>}
              {asked === m.id ? (
                <button
                  type="button"
                  className="btn text-amber"
                  onClick={async () => {
                    await removeMember(c.id, m.id);
                    setAsked(null);
                    await qc.invalidateQueries({ queryKey: ["class", c.id] });
                  }}
                >
                  {t("removeConfirm")}
                </button>
              ) : (
                <button type="button" className="btn" onClick={() => setAsked(m.id)} aria-label={t("removeMember", { name: m.name ?? t("aReader") })}>{t("remove")}</button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-t3">{t("rosterNone")}</p>
      )}
    </section>
  );
}

/** A member's own: their choice to show their detail (theirs to change), what the instructor sees, and leaving. */
function MySettings({ c }: { c: ClassOut }) {
  const t = useTranslations("classroom");
  const fail = useClassError();
  const qc = useQueryClient();
  const router = useRouter();
  const [asked, setAsked] = useState(false);
  const [said, setSaid] = useState("");
  // the reader's choice shown at once; put back if the server refuses it
  const [detail, setDetailOn] = useState(!!c.me?.detail_opt_in);
  return (
    <section aria-labelledby="mine-h" className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
      <h2 id="mine-h" className="text-[15px] font-semibold">{t("mySettings")}</h2>
      {!c.minors && (
        <label className="flex items-start gap-2 text-[13.5px] text-t1">
          <input
            type="checkbox"
            className="mt-1"
            checked={detail}
            onChange={async (e) => {
              const on = e.target.checked;
              setDetailOn(on);
              try {
                await setDetail(c.id, on);
                setSaid(t(on ? "detailOn" : "detailOff"));
                void qc.invalidateQueries({ queryKey: ["class", c.id] });
              } catch (err) {
                setDetailOn(!on);
                setSaid(fail(err));
              }
            }}
          />
          <span>
            {t("showDetail")}
            <span className="block text-[12px] text-t3">{t("showDetailHint")}</span>
          </span>
        </label>
      )}
      <details className="text-[13px]">
        <summary className="cursor-pointer text-t2">{t("whatTheySee")}</summary>
        <div className="pt-2">
          <ConsentText minors={c.minors} floor={FLOOR} />
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        {asked ? (
          <button
            type="button"
            className="btn text-amber"
            onClick={async () => {
              await leaveClass(c.id);
              await qc.invalidateQueries({ queryKey: ["classes"] });
              router.push("/classroom");
            }}
          >
            {t("leaveConfirm")}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => setAsked(true)}>{t("leave")}</button>
        )}
        <span role="status" className="text-[12.5px] text-t2">{said}</span>
      </div>
    </section>
  );
}

/** The class's own settings: its name, for minors, archived (no new lessons, no joining), deleted with all it held. */
function ClassSettings({ c }: { c: ClassOut }) {
  const t = useTranslations("classroom");
  const fail = useClassError();
  const qc = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState(c.name);
  const [asked, setAsked] = useState(false);
  const [said, setSaid] = useState("");
  const save = async (p: { name?: string; minors?: boolean; archived?: boolean }, done: string) => {
    try {
      await updateClass(c.id, p);
      await qc.invalidateQueries({ queryKey: ["class", c.id] });
      setSaid(done);
    } catch (err) {
      setSaid(fail(err));
    }
  };
  return (
    <section aria-labelledby="settings-h" className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
      <h2 id="settings-h" className="text-[15px] font-semibold">{t("classSettings")}</h2>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== c.name) void save({ name: name.trim() }, t("renamed"));
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12.5px] text-t2">
          {t("className")}
          <input className="field-input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} dir="auto" />
        </label>
        <button type="submit" className="btn">{t("rename")}</button>
      </form>
      <label className="flex items-start gap-2 text-[13px] text-t1">
        <input type="checkbox" className="mt-1" checked={c.minors} onChange={(e) => void save({ minors: e.target.checked }, t(e.target.checked ? "minorsOn" : "minorsOff"))} />
        <span>
          {t("forMinors")}
          <span className="block text-[12px] text-t3">{t("forMinorsHint")}</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={() => void save({ archived: !c.archived_at }, t(c.archived_at ? "unarchived" : "archived"))}>
          {t(c.archived_at ? "unarchive" : "archive")}
        </button>
        {asked ? (
          <button
            type="button"
            className="btn text-amber"
            onClick={async () => {
              await deleteClass(c.id);
              await qc.invalidateQueries({ queryKey: ["classes"] });
              router.push("/classroom");
            }}
          >
            {t("deleteClassConfirm")}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => setAsked(true)}>{t("deleteClass")}</button>
        )}
        <span role="status" className="text-[12.5px] text-t2">{said}</span>
      </div>
    </section>
  );
}
