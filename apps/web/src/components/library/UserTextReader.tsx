"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, type MouseEvent, useEffect, useRef, useState } from "react";
import { WordPanel } from "@/components/text/WordPanel";
import { MarksToggle } from "@/components/ui/MarksToggle";
import { Link, useRouter } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { cnt, formatNumber } from "@/lib/format";
import type { Form } from "@/lib/hadith";
import { deleteText, loadText, rootShown, saveText, userUri } from "@/lib/library/texts";
import { words } from "@/lib/library/segment";
import { useMarks } from "@/lib/reader/marks";
import { usePersonal } from "@/lib/reader/store";
import { isReview, readWords } from "./AddTextSheet";

/** One word of the reader's text, every reading the shared rules allow — asked in a body, kept nowhere (P11.3). */
async function readForm(token: string): Promise<Form> {
  const res = await fetch("/api/v1/analyse/form", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as Form;
}

/**
 * One of the reader's own texts (P4.4, LIB-36; P11.3: in the same reader as the hadith and the books): passage by
 * passage, every word read against the Quran and marked as found, to review or not found; a word chosen opens its
 * reading in the panel beside the text — its root in the Quran and in the dictionary, the Quran's word, the other
 * readings, the Analyser for one to review — and the hub's strip leads back to the passage (SHL-Q09). Rename and
 * delete (LIB-16).
 */
export function UserTextReader({ id }: { id: string }) {
  const t = useTranslations("library");
  // the vowel marks shown or hidden (D7): the reader's own text, never changed
  const shown = useMarks();
  const locale = useLocale();
  const fmtC = (x: number) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);
  const client = useIsClient();
  const router = useRouter();
  const qc = useQueryClient();
  const doc = useQuery({ queryKey: ["user-text", id], queryFn: () => loadText(id), enabled: client });
  const tokens = (doc.data?.passages ?? []).map((p) => words(p));
  const flat = tokens.flat().map((w) => w.word);
  const read = useQuery({ queryKey: ["user-text-read", id, doc.data?.updatedAt], queryFn: () => readWords(flat.slice(0, 20000)), enabled: !!doc.data });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [selected, setSelected] = useState<{ p: number; w: number } | null>(null);
  const panel = useRef<HTMLElement>(null);
  const chosen = selected ? (tokens[selected.p]?.[selected.w] ?? null) : null;
  const form = useQuery({ queryKey: ["user-form", chosen?.word], queryFn: () => readForm(chosen!.word), enabled: !!chosen, staleTime: Infinity });
  // the chosen word's other places in this text, by its lemma as the text was read (P1.3 "In this text", RDR-268)
  const places = (() => {
    if (!selected || !read.data) return null;
    const at = tokens.slice(0, selected.p).reduce((n, ws) => n + ws.length, 0) + selected.w;
    const lemma = read.data[at]?.r?.lemma;
    if (!lemma || read.data[at]?.r?.kind === "particle") return null;
    const out: { p: number; before: string; word: string; after: string }[] = [];
    let k = 0;
    tokens.forEach((ws, pi) =>
      ws.forEach((w, wi) => {
        if (read.data![k++]?.r?.lemma === lemma) out.push({ p: pi + 1, before: ws.slice(Math.max(0, wi - 5), wi).map((x) => x.surface).join(" "), word: w.surface, after: ws.slice(wi + 1, wi + 6).map((x) => x.surface).join(" ") });
      }),
    );
    return out;
  })();
  const position = usePersonal((s) => s.progress[userUri(id)]);
  const setProgress = usePersonal((s) => s.setProgress);
  const ready = !!doc.data;

  // the passage at the top of the screen is where the reader is (LIB-13): kept per text, for the shelf's bar
  // and for coming back
  useEffect(() => {
    if (!ready) return;
    const seen = new Map<number, boolean>();
    // only once the reader moves (a scroll, or a jump to #p…): opening the text must not overwrite where they were
    let moved = false;
    const record = () => {
      if (!moved) return;
      // at the foot of the page the last passage is where the reader is, though it cannot reach the top
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const top = [...seen].filter(([, v]) => v).map(([k]) => k);
      const passage = atEnd ? Math.max(...seen.keys()) : top.length ? Math.min(...top) : 0;
      if (passage > 0) setProgress(userUri(id), { chapter: 1, passage });
    };
    const onScroll = () => {
      moved = true;
      record();
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(Number((e.target as HTMLElement).id.slice(1)), e.isIntersecting);
        record();
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    document.querySelectorAll(".user-passage[id^='p']").forEach((el) => io.observe(el));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [ready, id, setProgress]);

  // Esc closes the panel and gives the focus back to the word
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      document.querySelector<HTMLButtonElement>(`.user-text button[data-p="${selected.p}"][data-w="${selected.w}"]`)?.focus();
      setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);
  const onClick = (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-w]");
    if (!b) return;
    setSelected({ p: Number(b.dataset.p), w: Number(b.dataset.w) });
    requestAnimationFrame(() => panel.current?.focus());
  };

  if (!client || doc.isLoading) return <div className="m-6 h-40 animate-pulse rounded-xl bg-card-2" role="status" aria-label={t("loading")} />;
  if (!doc.data)
    return (
      <div className="library-screen">
        <p className="text-[14px] text-t2" role="alert">{t("textMissing")}</p>
        <Link href="/library" className="btn self-start">{t("backToLibrary")}</Link>
      </div>
    );
  const d = doc.data;
  let i = 0;
  return (
    <article className="library-screen user-text" aria-label={d.title}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/library" className="text-[12.5px] text-t3 hover:text-t1">{t("backToLibrary")}</Link>
        <span className="flex-1" />
        {!editing && (
          <button type="button" className="btn" onClick={() => { setTitle(d.title); setEditing(true); }}>{t("rename")}</button>
        )}
        {confirm ? (
          <>
            <span className="text-[12.5px] text-t2">{t("deleteConfirm")}</span>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>{t("cancel")}</button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                await deleteText(d.id);
                await qc.invalidateQueries({ queryKey: ["user-texts"] });
                router.push("/library");
              }}
            >
              {t("delete")}
            </button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirm(true)}>{t("delete")}</button>
        )}
      </div>
      {editing ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            await saveText({ ...d, title: title.trim() });
            await qc.invalidateQueries({ queryKey: ["user-text", id] });
            await qc.invalidateQueries({ queryKey: ["user-texts"] });
            setEditing(false);
          }}
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} dir="rtl" lang="ar" className="field ar-classical text-[18px]" aria-label={t("textTitle")} data-autofocus />
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>{t("saveTitle")}</button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>{t("cancel")}</button>
        </form>
      ) : (
        <h1 className="ar-classical text-[28px]" lang="ar" dir="rtl">{d.title}</h1>
      )}
      <p className="text-[12.5px] text-t3">
        {t("mineMeta", { words: formatNumber(d.words, locale), review: formatNumber(d.review, locale) })} • {t("privateNote")}
      </p>
      {d.source && (
        <p className="text-[12.5px] text-t3">
          {d.source.kind === "url" ? (
            <>
              {t("sourceUrl")}{" "}
              <a href={d.source.url} className="underline decoration-dotted underline-offset-2 hover:text-t1" rel="noopener noreferrer" target="_blank">
                <bdi dir="ltr">{d.source.site ?? d.source.url}</bdi>
              </a>
            </>
          ) : (
            <>
              {t("sourcePdf")} <bdi dir="ltr">{d.source.name}</bdi>
            </>
          )}
        </p>
      )}
      {position && position.passage > 1 && (
        <a href={`#p${position.passage}`} className="btn self-start">
          {t("resumeText", { n: formatNumber(position.passage, locale), of: formatNumber(d.passages.length, locale) })}
        </a>
      )}
      <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-t3">
        <MarksToggle />
        <span className="pv-word is-hit">{t("legendHit")}</span>
        <span className="pv-word is-review">{t("legendReview")}</span>
        <span className="pv-word is-none">{t("legendNone")}</span>
      </div>
      {read.isError && <p className="text-[12.5px] text-bad" role="alert">{t("previewFailed")}</p>}
      <div className="hadith-reader">
        <div className="flex min-w-0 flex-col gap-2" onClick={onClick}>
          {tokens.map((ws, pi) => (
            <p key={pi} id={`p${pi + 1}`} className="user-passage" dir="rtl" lang="ar">
              {ws.map((w, wi) => {
                // one index per word, taken before anything reads it: pending words had all shared key 0
                const k = i++;
                const r = read.data?.[k]?.r;
                const cls = !read.data ? "is-pending" : isReview(r) ? "is-review" : r && r.kind !== "none" && r.lemma ? "is-hit" : "is-none";
                const tip = !read.data ? undefined : isReview(r) ? t("tipReview", { root: rootShown(r) ?? "—", c: fmtC(r?.confidence ?? 0) }) : cls === "is-hit" ? (r!.kind === "particle" ? t("tipParticle") : `${r!.root_spaced ?? ""}${r!.gloss_en ? ` — ${r!.gloss_en}` : ""}`) : t("tipNone");
                const on = selected?.p === pi && selected.w === wi;
                return (
                  <Fragment key={k}>
                    <button type="button" className={`pv-word ${cls}${on ? " is-selected" : ""}`} data-p={pi} data-w={wi} aria-pressed={on} title={tip}>
                      {shown(w.surface)}
                    </button>{" "}
                  </Fragment>
                );
              })}
            </p>
          ))}
        </div>
        <WordPanel
          ref={panel}
          word={chosen ? shown(chosen.surface) : null}
          form={form.data ?? null}
          onClose={() => setSelected(null)}
          hint={t("wordHint")}
          place={selected ? { href: `/library/text/${id}#p${selected.p + 1}`, label: d.title } : null}
        >
          {chosen && form.data && ["clitic", "pattern", "pattern-dict", "weak", "weak-dict"].includes(form.data.kind) && (
            <Link href={`/analyse?q=${encodeURIComponent(chosen.word)}`} className="btn self-start">
              {t("reviewInAnalyser")}
            </Link>
          )}
          {places && places.length > 0 && (
            <section className="flex flex-col gap-1.5 border-t border-line pt-3" aria-label={t("inTextTitle")} data-testid="in-this-text">
              <p className="text-[13px] font-medium">{t("inTextTitle")}</p>
              <p className="text-[12.5px] text-t2">{t("inTextCount", cnt(places.length, locale))}</p>
              <ul className="flex flex-col gap-1.5">
                {places.slice(0, 3).map((x, n) => (
                  <li key={n}>
                    <a href={`#p${x.p}`} className="flex flex-col gap-0.5 rounded-md px-1.5 py-1 hover:bg-card-2">
                      <span className="ar-classical text-[15px] leading-[1.8]" lang="ar" dir="rtl">
                        <span className="text-t2">{shown(x.before)} </span>
                        <mark className="kwic-word">{shown(x.word)}</mark>
                        <span className="text-t2"> {shown(x.after)}</span>
                      </span>
                      <span className="text-[11px] text-t3">{t("inTextPassage", { n: formatNumber(x.p, locale) })}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </WordPanel>
      </div>
    </article>
  );
}
