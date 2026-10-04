"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cnt, formatNumber, toArabicDigits } from "@/lib/format";
import type { TextSource } from "@/lib/library/texts";

export type Imported = { title: string; text: string; source: TextSource };

type PdfPage = { n: number; status: "text" | "reversed" | "broken" | "scan"; reason: string | null; text: string; hits: number };
type PdfAnswer = { title: string; pages: PdfPage[]; counts: Record<PdfPage["status"], number> };

/** A refusal's code as the API names it (refusal.py), said in the reader's language. */
async function refusal(res: Response): Promise<string> {
  try {
    return ((await res.json()) as { error?: { code?: string } }).error?.code ?? "failed";
  } catch {
    return "failed";
  }
}

/**
 * A web page's main text (P11.3c): its address sent in a body to our server, which fetches the page, keeps its
 * words without the menus and notes, hands them back and keeps nothing.
 */
export function FromUrl({ onImported }: { onImported: (x: Imported) => void }) {
  const t = useTranslations("library");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/intake/url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      if (!res.ok) {
        setError(await refusal(res));
        return;
      }
      const d = (await res.json()) as { title: string; text: string; url: string; site: string | null };
      onImported({ title: d.title, text: d.text, source: { kind: "url", url: d.url, site: d.site ?? undefined } });
    } catch {
      setError("offline");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void go();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="label-caps">{t("urlLabel")}</span>
        <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" className="field text-[15px]" placeholder="https://" data-autofocus />
      </label>
      <button type="submit" className={"btn " + (url.length > 8 && !busy ? "btn-primary" : "")} disabled={busy || url.length < 9}>
        {busy ? t("importing") : t("urlGo")}
      </button>
      {error && (
        <p className="text-[12.5px] text-bad" role="alert">
          {t(`intake_${error}` as "intake_failed")}
        </p>
      )}
      <p className="text-[11.5px] leading-relaxed text-t3">{t("urlNote")}</p>
    </form>
  );
}

/**
 * A PDF (P11.3c): sent to our server, which reads each page's text layer and tells it apart — a sound layer, one in
 * visual order (turned back), a broken one, a scan — hands the pages back and keeps nothing. The reader chooses the
 * pages to add; a scan or a broken page waits for OCR, said so.
 */
export function FromPdf({ onImported }: { onImported: (x: Imported) => void }) {
  const t = useTranslations("library");
  const locale = useLocale();
  const [answer, setAnswer] = useState<(PdfAnswer & { name: string }) | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const digits = (n: number) => (locale === "ar" ? toArabicDigits(n) : String(n));

  async function read(file: File) {
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/v1/intake/pdf", { method: "POST", body });
      if (!res.ok) {
        setError(await refusal(res));
        return;
      }
      const d = (await res.json()) as PdfAnswer;
      setAnswer({ ...d, name: file.name });
      setChosen(new Set(d.pages.filter((p) => p.status === "text" || p.status === "reversed").map((p) => p.n)));
    } catch {
      setError("offline");
    } finally {
      setBusy(false);
    }
  }

  const readable = answer?.pages.filter((p) => p.status === "text" || p.status === "reversed") ?? [];
  const waiting = answer?.pages.filter((p) => p.status === "scan" || p.status === "broken") ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className="label-caps" aria-hidden="true">{t("pdfLabel")}</span>
        {/* the browser's own file button speaks its own language: ours speaks the page's */}
        <label className="btn file-pick self-start">
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label={t("pdfLabel")}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f.name);
                void read(f);
              }
            }}
          />
          {file ? t("pdfAnother") : t("pdfPick")}
        </label>
        {file && <bdi dir="ltr" className="self-start text-[12px] text-t3">{file}</bdi>}
      </div>
      {busy && <p className="text-[12.5px] text-t3" role="status">{t("importing")}</p>}
      {error && (
        <p className="text-[12.5px] text-bad" role="alert">
          {t(`intake_${error}` as "intake_failed")}
        </p>
      )}
      {answer && (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-t2">
            {t("pdfCounts", {
              text: formatNumber(answer.counts.text + answer.counts.reversed, locale),
              reversed: formatNumber(answer.counts.reversed, locale),
              waiting: formatNumber(answer.counts.scan + answer.counts.broken, locale),
            })}
          </p>
          {readable.length > 0 && (
            <fieldset className="flex max-h-[220px] flex-col gap-1 overflow-y-auto rounded-lg border border-line p-2">
              <legend className="label-caps px-1">{t("pdfChoose")}</legend>
              {readable.map((p) => (
                <label key={p.n} className="flex items-baseline gap-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={chosen.has(p.n)}
                    onChange={(e) => {
                      const next = new Set(chosen);
                      if (e.target.checked) next.add(p.n);
                      else next.delete(p.n);
                      setChosen(next);
                    }}
                  />
                  <span className="shrink-0 text-t3">{t("pdfPage", { n: digits(p.n) })}</span>
                  {p.status === "reversed" && <span className="state-chip shrink-0">{t("pdfReversed")}</span>}
                  <span className="line-clamp-1 min-w-0 ar-classical text-[14px]" lang="ar" dir="rtl">{p.text.slice(0, 120)}</span>
                </label>
              ))}
            </fieldset>
          )}
          {waiting.length > 0 && (
            <p className="text-[12px] leading-relaxed text-t3">
              {t("pdfWaiting", { pages: waiting.slice(0, 12).map((p) => digits(p.n)).join(locale === "ar" ? "، " : ", ") + (waiting.length > 12 ? "…" : "") })}
            </p>
          )}
          <button
            type="button"
            className={"btn " + (chosen.size ? "btn-primary" : "")}
            disabled={!chosen.size}
            onClick={() =>
              onImported({
                title: answer.title,
                text: answer.pages.filter((p) => chosen.has(p.n)).map((p) => p.text).join("\n\n"),
                source: { kind: "pdf", name: answer.name, pages: [...chosen].sort((a, b) => a - b) },
              })
            }
          >
            {t("pdfAdd", cnt(chosen.size, locale))}
          </button>
        </div>
      )}
      <p className="text-[11.5px] leading-relaxed text-t3">{t("pdfNote")}</p>
    </div>
  );
}
