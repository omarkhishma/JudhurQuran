"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/store";
import { createClass, getClasses, rangesLine, readPack, type ClassOut, type LessonPack } from "@/lib/classroom";
import { useIsClient } from "@/lib/client";
import { cnt } from "@/lib/format";
import { NoteLine, useClassError, useFmt, useSurahNames } from "./shared";

/**
 * The classroom's home (P9.1, CLS-01, 02, Q01, Q07): the classes this reader teaches and those they joined, a new
 * class for an instructor, and a lesson opened from a file with no account at all.
 */
export function ClassroomHome() {
  const t = useTranslations("classroom");
  const client = useIsClient();
  const session = useAccount((s) => s.session);
  const q = useQuery({ queryKey: ["classes", session], queryFn: getClasses, enabled: client && !!session, refetchOnWindowFocus: true });
  if (!client) return <div className="mx-auto h-64 max-w-[960px] animate-pulse rounded-xl bg-card-2" aria-hidden="true" />;
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[24px] font-semibold text-t1">{t("title")}</h1>
        <p className="max-w-[680px] text-[14px] leading-relaxed text-t2">{t("lead")}</p>
      </header>
      {!session ? (
        <section className="flex flex-col items-start gap-3 rounded-xl border border-line bg-card p-5">
          <p className="text-[14px] leading-relaxed text-t1">{t("signedOut")}</p>
          <Link href={`/signin?next=${encodeURIComponent("/classroom")}`} className="btn btn-primary">{t("signIn")}</Link>
        </section>
      ) : q.isPending ? (
        <span className="block h-40 animate-pulse rounded-xl bg-card-2" aria-hidden="true" />
      ) : q.isError ? (
        <p role="alert" className="text-[14px] text-t2">{t("loadFailed")}</p>
      ) : (
        <>
          {(q.data.can_teach || q.data.teaching.length > 0) && (
            <section aria-labelledby="teaching-h" className="flex flex-col gap-3">
              <h2 id="teaching-h" className="text-[17px] font-semibold">{t("teaching")}</h2>
              {q.data.teaching.length ? <ClassList items={q.data.teaching} /> : <p className="text-[13.5px] text-t3">{t("teachingNone")}</p>}
              {q.data.can_teach && <NewClass />}
            </section>
          )}
          <section aria-labelledby="learning-h" className="flex flex-col gap-3">
            <h2 id="learning-h" className="text-[17px] font-semibold">{t("learning")}</h2>
            {q.data.learning.length ? <ClassList items={q.data.learning} /> : <p className="text-[13.5px] text-t3">{t("learningNone")}</p>}
          </section>
          {!q.data.can_teach && <p className="text-[12.5px] leading-relaxed text-t3">{t("whoTeaches")}</p>}
        </>
      )}
      <PackOpener />
    </div>
  );
}

function ClassList({ items }: { items: ClassOut[] }) {
  const t = useTranslations("classroom");
  const locale = useLocale();
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`/classroom/${c.id}`} className="flex h-full flex-col gap-1 rounded-xl border border-line bg-card p-4 hover:border-line-2">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[16px] font-semibold text-t1" dir="auto">{c.name}</span>
              {c.minors && <span className="state-chip">{t("minorsChip")}</span>}
              {c.archived_at && <span className="state-chip">{t("archivedChip")}</span>}
            </span>
            <span className="text-[12.5px] text-t3">
              {c.role === "instructor" ? t("membersCount", cnt(c.members, locale)) : t("taughtBy", { name: c.instructor.name ?? t("anInstructor") })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A new class: its name, and whether it is for minors (then no one's detail is ever shown). */
function NewClass() {
  const t = useTranslations("classroom");
  const fail = useClassError();
  const router = useRouter();
  const [name, setName] = useState("");
  const [minors, setMinors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4"
      aria-labelledby="new-class-h"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
          const c = await createClass(name.trim(), minors);
          router.push(`/classroom/${c.id}`);
        } catch (err) {
          setSaid(fail(err));
          setBusy(false);
        }
      }}
    >
      <h3 id="new-class-h" className="text-[14px] font-semibold">{t("newClass")}</h3>
      <label className="flex flex-col gap-1 text-[12.5px] text-t2">
        {t("className")}
        <input className="field-input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} dir="auto" required />
      </label>
      <label className="flex items-start gap-2 text-[13px] text-t1">
        <input type="checkbox" className="mt-1" checked={minors} onChange={(e) => setMinors(e.target.checked)} />
        <span>
          {t("forMinors")}
          <span className="block text-[12px] text-t3">{t("forMinorsHint")}</span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>{t("create")}</button>
        <span role="status" className="text-[12.5px] text-t2">{said}</span>
      </div>
    </form>
  );
}

/** A lesson opened from its file (CLS-Q07): read in this browser only, with no account — its verses, roots and the
 * instructor's notes, each a way into the reader. */
function PackOpener() {
  const t = useTranslations("classroom");
  const [pack, setPack] = useState<LessonPack | null>(null);
  const [said, setSaid] = useState("");
  return (
    <section aria-labelledby="pack-h" className="flex flex-col gap-3 rounded-xl border border-dashed border-line-2 p-4">
      <h2 id="pack-h" className="text-[15px] font-semibold">{t("packTitle")}</h2>
      <p className="text-[13px] leading-relaxed text-t2">{t("packLead")}</p>
      <label className="btn self-start">
        {t("packOpen")}
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const p = readPack(JSON.parse(await f.text()));
              setPack(p);
              setSaid(p ? "" : t("packBad"));
            } catch {
              setPack(null);
              setSaid(t("packBad"));
            }
          }}
        />
      </label>
      <p role="status" className="text-[12.5px] text-t2">{said}</p>
      {pack && <PackView pack={pack} />}
    </section>
  );
}

export function PackView({ pack }: { pack: LessonPack }) {
  const t = useTranslations("classroom");
  const names = useSurahNames();
  const fmt = useFmt();
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4" aria-labelledby="pack-lesson-h">
      <div className="flex flex-col gap-0.5">
        <h3 id="pack-lesson-h" className="text-[17px] font-semibold" dir="auto">{pack.title}</h3>
        <p className="text-[12.5px] text-t3" dir="auto">{[pack.class, pack.instructor].filter(Boolean).join(" · ")}</p>
      </div>
      <p className="text-[14px] text-t1">{rangesLine(pack.ranges, names, fmt)}</p>
      <div className="flex flex-wrap gap-2">
        {pack.ranges.map((r, i) => (
          <Link key={i} href={`/quran/${r.surah}/${r.from}`} className="btn">{t("readRange", { range: rangesLine([r], names, fmt) })}</Link>
        ))}
      </div>
      {pack.roots.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caps">{t("roots")}</span>
          {pack.roots.map((r) => (
            <Link key={r.key} href={`/roots/${encodeURIComponent(r.key)}`} className="chip ar-classical text-[15px]" lang="ar">{r.spaced}</Link>
          ))}
        </div>
      )}
      {pack.notes.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="label-caps">{t("lessonNotes")}</span>
          <ul className="flex flex-col gap-1 text-[13.5px] text-t1">
            {pack.notes.map((n, i) => (
              <li key={i}>
                <NoteLine n={n} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
