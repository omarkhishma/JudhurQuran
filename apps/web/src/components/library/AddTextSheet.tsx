"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { type FormResult, type TextSource, newTextId, saveText } from "@/lib/library/texts";
import { hasTashkil, passages, words } from "@/lib/library/segment";
import { useDebounced } from "@/lib/useDebounced";
import { FromPdf, FromUrl, type Imported } from "./Intake";

export const PREVIEW_WORDS = 80;
const MAX_CHARS = 200_000;
type Batch = { token_keys: string[]; forms: Record<string, FormResult>; distinct: number; unread: number };

/** Read words against the Quran (POST: the reader's text appears in no URL, log or cache, and is not stored). */
export async function readWords(tokens: string[]): Promise<{ token: string; r: FormResult | undefined }[]> {
  if (!tokens.length) return [];
  const res = await fetch("/api/v1/analyse/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokens }) });
  if (!res.ok) throw new Error(String(res.status));
  const d = (await res.json()) as Batch;
  return tokens.map((token, i) => ({ token, r: d.forms[d.token_keys[i]] }));
}

export const isReview = (r: FormResult | undefined) => !!r && (r.kind === "clitic" || r.kind === "pattern" || (r.kind === "form" && r.confidence < 0.8));

/**
 * Add a text (design 05 §5.1, LIB-17…35 with LIB-45/48; P11.3c): pasted, or brought from a web page or a PDF — read
 * on our server and handed back, never kept there — then a live preview of the first words read against the Quran
 * (matched, to review with the Analyser one click away, not found) and a save that cuts the text into passages and
 * keeps it in this browser with where it came from. A scanned page waits for OCR, said so (LIB-48: nothing is
 * promised that is not offered). No vowels are added to anyone's text.
 */
export function AddTextSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("library");
  const locale = useLocale();
  const fmtC = (x: number) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);
  const [mode, setMode] = useState<"paste" | "url" | "pdf">("paste");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<TextSource | undefined>(undefined);
  const imported = (x: Imported) => {
    setText(x.text.slice(0, MAX_CHARS));
    if (!title.trim()) setTitle(x.title);
    setSource(x.source);
    setMode("paste");
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dtext = useDebounced(text, 400);
  const all = useMemo(() => passages(dtext.slice(0, MAX_CHARS)).flatMap((p) => words(p)), [dtext]);
  const head = all.slice(0, PREVIEW_WORDS);
  const preview = useQuery({ queryKey: ["text-preview", head.map((w) => w.word).join(" ")], queryFn: () => readWords(head.map((w) => w.word)), enabled: head.length > 0 });
  const counted = text.trim() ? words(text.slice(0, MAX_CHARS)).length : 0;
  const rows = preview.data ?? [];
  const matched = rows.filter((x) => x.r && (x.r.kind === "form" || x.r.kind === "particle") && !isReview(x.r)).length;
  const review = rows.filter((x) => isReview(x.r));
  const unknown = rows.filter((x) => !x.r || x.r.kind === "none").length;
  const roots = new Set(rows.map((x) => x.r?.root).filter(Boolean)).size;
  const entries = new Set(rows.map((x) => x.r?.lemma).filter(Boolean)).size;
  const matchPct = rows.length ? matched / rows.length : null;
  const valid = text.trim().length > 10 && title.trim().length > 0 && !saving;

  async function save() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const ps = passages(text.slice(0, MAX_CHARS));
      const ws = ps.flatMap((p) => words(p)).map((w) => w.word);
      const read = await readWords(ws.slice(0, 20000));
      const now = Date.now();
      await saveText({
        id: newTextId(),
        title: title.trim(),
        text: text.slice(0, MAX_CHARS),
        ...(source ? { source } : {}),
        passages: ps,
        words: ws.length,
        // content words the Quran attests, for "% known" by unique lemma (particles are not counted)
        lemmas: [...new Set(read.filter((x) => x.r && x.r.kind !== "particle" && x.r.lemma).map((x) => x.r!.lemma as string))],
        // counted over the whole text, not the preview (LIB-35)
        review: read.filter((x) => isReview(x.r)).length,
        unknown: read.filter((x) => !x.r || x.r.kind === "none").length,
        createdAt: now,
        updatedAt: now,
      });
      onSaved();
    } catch {
      setError(t("saveFailed"));
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} label={t("newText")} width={900}>
      <div className="flex max-h-[85vh] flex-col overflow-y-auto">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold">{t("newText")}</h2>
          <span className="flex-1" />
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t("close")}>✕</button>
        </div>
        <div className="add-text-body">
          <div className="flex flex-col gap-3">
            <div role="group" aria-label={t("modesLabel")} className="flex flex-wrap gap-1.5">
              {(["paste", "url", "pdf"] as const).map((m) => (
                <button key={m} type="button" className={`chip${mode === m ? " is-on" : ""}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {t(m === "paste" ? "modePaste" : m === "url" ? "modeUrl" : "modePdf")}
                </button>
              ))}
            </div>
            {mode === "url" && <FromUrl onImported={imported} />}
            {mode === "pdf" && <FromPdf onImported={imported} />}
            {mode === "paste" && (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <label className="flex flex-col gap-1">
                  <span className="label-caps">{t("yourText")}</span>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} dir="rtl" lang="ar" className="add-text-input" placeholder={t("pastePlaceholder")} data-autofocus />
                </label>
                {source && (
                  <p className="text-[12px] text-t2" role="status">
                    {t("importedFrom", { from: source.kind === "url" ? (source.site ?? source.url) : source.name })}
                  </p>
                )}
                <p className="text-[12px] text-t3">
                  {counted ? t(hasTashkil(text) ? "metaVowelled" : "metaBare", { n: formatNumber(counted, locale) }) : t("metaEmpty")}
                </p>
                <label className="flex flex-col gap-1">
                  <span className="label-caps">{t("textTitle")}</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} dir="rtl" lang="ar" className="field ar-classical text-[16px]" placeholder={t("titlePlaceholder")} />
                </label>
                <button type="submit" className={"btn " + (valid ? "btn-primary" : "")} disabled={!valid}>
                  {saving ? t("saving") : t("save")}
                </button>
                {error && (
                  <p className="text-[12.5px] text-bad" role="alert">
                    {error}
                  </p>
                )}
                <p className="text-[11.5px] leading-relaxed text-t3">{t("privacy")}</p>
              </form>
            )}
          </div>
          <section className="flex min-w-0 flex-col gap-2" aria-label={t("preview")}>
            <div className="flex items-center gap-2">
              <span className="label-caps">{t("preview")}</span>
              <span className="flex-1" />
              <span className={"match-badge " + (matchPct == null ? "" : matchPct >= 0.8 ? "is-good" : matchPct >= 0.5 ? "is-mid" : "is-low")}>
                {matchPct == null ? "—" : t("matched", { pct: new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { style: "percent" }).format(matchPct) })}
              </span>
            </div>
            {head.length === 0 ? (
              <p className="text-[13px] text-t3">{t("previewEmpty")}</p>
            ) : preview.isError ? (
              <p className="text-[12.5px] text-bad" role="alert">{t("previewFailed")}</p>
            ) : (
              <p className="add-text-preview" dir="rtl" lang="ar">
                {head.map((w, i) => {
                  const r = rows[i]?.r;
                  const cls = !rows.length ? "is-pending" : isReview(r) ? "is-review" : r && r.kind !== "none" ? "is-hit" : "is-none";
                  const tip = !r || r.kind === "none" ? t("tipNone") : isReview(r) ? t("tipReview", { root: r.root_spaced ?? "—", c: fmtC(r.confidence) }) : r.kind === "particle" ? t("tipParticle") : `${r.root_spaced ?? ""}${r.gloss_en ? ` — ${r.gloss_en}` : ""}`;
                  return (
                    <span key={i} className={"pv-word " + cls} title={tip}>
                      {w.surface}{" "}
                    </span>
                  );
                })}
              </p>
            )}
            {review.length > 0 && (
              <ul className="review-rows">
                {review.slice(0, 3).map((x, i) => (
                  <li key={i}>
                    <span className="ar-classical text-[16px]" lang="ar">{x.token}</span>
                    <span className="flex-1 text-[12px] text-t2">{t("reviewRow", { root: x.r?.root_spaced ?? "—", c: fmtC(x.r?.confidence ?? 0) })}</span>
                    <Link href={`/analyse?q=${encodeURIComponent(x.token)}`} className="text-[12px] underline-offset-2 hover:underline">{t("analyse")}</Link>
                  </li>
                ))}
              </ul>
            )}
            {rows.length > 0 && (
              <p className="text-[11.5px] text-t3">
                {t("previewCounts", { roots: formatNumber(roots, locale), entries: formatNumber(entries, locale), review: formatNumber(review.length, locale), none: formatNumber(unknown, locale) })}
                {all.length > PREVIEW_WORDS && ` • ${t("previewFirst", { n: formatNumber(PREVIEW_WORDS, locale) })}`}
              </p>
            )}
          </section>
        </div>
      </div>
    </Dialog>
  );
}
