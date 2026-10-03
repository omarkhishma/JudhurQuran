"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useIsClient } from "@/lib/client";
import { formatNumber } from "@/lib/format";
import { deleteText, loadText, saveText } from "@/lib/library/texts";
import { words } from "@/lib/library/segment";
import { isReview, readWords } from "./AddTextSheet";

/**
 * One of the reader's own texts (P4.4, LIB-36): passage by passage, every word read against the Quran — a word
 * the Quran attests opens its entry, one to review opens in the Analyser, one not found stays plain. Rename and
 * delete (LIB-16). The full multi-text reader (rail, panel, trail) comes with the other texts in P11.
 */
export function UserTextReader({ id }: { id: string }) {
  const t = useTranslations("library");
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
        {t("mineMeta", { words: formatNumber(d.words, locale), review: formatNumber(d.review, locale) })} · {t("privateNote")}
      </p>
      <div className="flex flex-wrap gap-3 text-[11.5px] text-t3">
        <span className="pv-word is-hit">{t("legendHit")}</span>
        <span className="pv-word is-review">{t("legendReview")}</span>
        <span className="pv-word is-none">{t("legendNone")}</span>
      </div>
      {read.isError && <p className="text-[12.5px] text-bad" role="alert">{t("previewFailed")}</p>}
      {tokens.map((ws, pi) => (
        <p key={pi} className="user-passage" dir="rtl" lang="ar">
          {ws.map((w) => {
            const r = read.data?.[i++]?.r;
            const word = `${w.surface} `;
            if (!read.data) return <span key={i} className="pv-word is-pending">{word}</span>;
            if (isReview(r)) return <Link key={i} href={`/analyse?q=${encodeURIComponent(w.word)}`} className="pv-word is-review" title={t("tipReview", { root: r?.root_spaced ?? "—", c: fmtC(r?.confidence ?? 0) })}>{word}</Link>;
            if (r && r.kind !== "none" && r.lemma) return <Link key={i} href={`/read?w=${encodeURIComponent(r.lemma)}`} className="pv-word is-hit" title={r.kind === "particle" ? t("tipParticle") : `${r.root_spaced ?? ""}${r.gloss_en ? ` — ${r.gloss_en}` : ""}`}>{word}</Link>;
            return <span key={i} className="pv-word is-none" title={t("tipNone")}>{word}</span>;
          })}
        </p>
      ))}
    </article>
  );
}
