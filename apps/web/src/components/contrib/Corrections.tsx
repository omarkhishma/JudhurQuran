"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { SignInPanel } from "@/components/account/SignInPanel";
import { useAccount } from "@/lib/account/store";
import { useIsClient } from "@/lib/client";
import { usePersonal } from "@/lib/reader/store";
import { type CorrectionField, type Merge, submit } from "@/lib/contrib";
import { formatNumber } from "@/lib/format";
import { useRefusal } from "./refusal";

type Out = { target: string; label: string; data: Merge[]; waiting: number };

/**
 * Corrections to a layer the build made by rule (B58, RVQ-Q11) — a hadith's split into isnād and matn, a name in its
 * isnād, a dictionary article's root, a book paragraph's printed page: those in force shown beside what the build made,
 * which stays as it was, credited; how many wait in the edit requests; and a short form that sends one there, to the
 * same two approvals as a word's. Compact, it is one line until a correction is in force or waiting, or the reader
 * opens it.
 */
export function Corrections({ target, label, fields, narrators, compact = false }: { target: string; label: string; fields: CorrectionField[]; narrators?: { ordinal: number; text: string }[]; compact?: boolean }) {
  const t = useTranslations("contrib");
  const locale = useLocale();
  const id = useId();
  const q = useCorrections(target);
  const [open, setOpen] = useState(false);
  const inForce = q.data?.data ?? [];
  if (compact && !open && inForce.length === 0 && !q.data?.waiting)
    return (
      <p className="text-[12px] text-t3">
        <button type="button" className="underline underline-offset-2 hover:text-t1" onClick={() => setOpen(true)}>
          {t("correctionPropose")}
        </button>
        {` — ${fields.map((f) => t(`correctionField.${f}`)).join(" • ")}`}
      </p>
    );
  return (
    <section id="corrections" aria-labelledby={id} className="flex scroll-mt-20 flex-col gap-2 rounded-lg border border-line bg-card px-3 py-2.5">
      <h2 id={id} className="text-[14px] font-semibold">{t("correctionsTitle")}</h2>
      <p className="text-[12px] leading-relaxed text-t3">{t("correctionsLead")}</p>
      <InForce items={inForce} />
      {!!q.data?.waiting && (
        <p className="text-[12px] text-t3">
          {t("correctionsWaiting", { n: formatNumber(q.data.waiting, locale) })} <Link href="/review" className="underline underline-offset-2">{t("title")}</Link>
        </p>
      )}
      {open ? <CorrectionForm target={target} label={label} fields={fields} narrators={narrators} onDone={() => setOpen(false)} /> : (
        <button type="button" className="btn min-h-[36px] self-start text-[12.5px]" onClick={() => setOpen(true)}>
          {t("correctionPropose")}
        </button>
      )}
    </section>
  );
}

/** An item's corrections in force and how many wait — one request, shared by the section and the marks. */
function useCorrections(target: string) {
  const client = useIsClient();
  return useQuery({
    queryKey: ["corrections", target],
    // a failure leaves the page as the build made it: nothing shown in force, never a broken page
    queryFn: async () => {
      const r = await fetch(`/api/v1/corrections?target=${encodeURIComponent(target)}`);
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as Out;
    },
    enabled: client && !!target,
    retry: 1,
  });
}

/** Beside what the build made — a name in the isnād, the split — when readers corrected it (B58): said, and a way to
 * the correction. */
export function CorrectedMark({ target, field, location }: { target: string; field: CorrectionField; location?: number }) {
  const t = useTranslations("contrib");
  const q = useCorrections(target);
  if (!q.data?.data.some((m) => m.field === field && (location === undefined || m.location === String(location)))) return null;
  return (
    <a href="#corrections" className="state-chip text-[11.5px] hover:underline">
      {t("correctedMark")}
    </a>
  );
}

/** The corrections in force on many items at once — a dictionary page's articles — in one request (B58). */
export function useCorrectionsInForce(targets: string[]) {
  const client = useIsClient();
  return useQuery({
    queryKey: ["corrections-in-force", targets],
    queryFn: async () => {
      const qs = targets.slice(0, 80).map((x) => `targets=${encodeURIComponent(x)}`).join("&");
      const r = await fetch(`/api/v1/corrections/in-force?${qs}`);
      if (!r.ok) throw new Error(String(r.status));
      return ((await r.json()) as { data: Record<string, Merge[]> }).data;
    },
    retry: 1,
    enabled: client && targets.length > 0,
  });
}

/** Each correction in force: what it corrects, the correction in the reader's words, who proposed it, how many approved
 * it and when. */
export function InForce({ items }: { items: Merge[] }) {
  const t = useTranslations("contrib");
  const locale = useLocale();
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return items.map((m) => (
    <article key={m.id} className="flex flex-col gap-0.5 border-t border-line pt-1.5">
      <p className="text-[12px] font-medium text-t2">
        {t(`correctionField.${m.field as CorrectionField}`)}
        {m.location && ` • ${t("narratorAt", { n: formatNumber(Number(m.location), locale) })}`}
      </p>
      <p className="whitespace-pre-line text-[14px] text-t1" dir="auto">{m.text}</p>
      <p className="text-[11.5px] text-t3">{t("correctionBy", { name: m.contributor ?? t("aReader"), n: formatNumber(m.reviewers.length, locale), date: date(m.merged_at) })}</p>
    </article>
  ));
}

/** A dictionary article's corrections (B58): its root as readers corrected it, beside the article, and a line that
 * opens the form — the page fetches every article's corrections at once. */
export function ArticleCorrections({ target, label, inForce }: { target: string; label: string; inForce: Merge[] }) {
  const t = useTranslations("contrib");
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 flex flex-col gap-2">
      {inForce.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-card px-3 py-2">
          <p className="text-[12.5px] font-semibold">{t("correctionsTitle")}</p>
          <InForce items={inForce} />
        </div>
      )}
      {open ? (
        <CorrectionForm target={target} label={label} fields={["filing"]} onDone={() => setOpen(false)} />
      ) : (
        <p className="text-[12px] text-t3">
          <button type="button" className="underline underline-offset-2 hover:text-t1" onClick={() => setOpen(true)}>
            {t("correctionPropose")}
          </button>
          {` — ${t("correctionField.filing")}`}
        </p>
      )}
    </div>
  );
}

/** The form: written first, signed in or not; signed out, it is kept on this device and sign-in is asked for only now,
 * after the writing, never before, and it goes to the queue on sign-in (RVQ-Q02, 10 §4.4) — as a word's proposal does. */
export function CorrectionForm({ target, label, fields, narrators, onDone }: { target: string; label: string; fields: CorrectionField[]; narrators?: { ordinal: number; text: string }[]; onDone: () => void }) {
  const t = useTranslations("contrib");
  const locale = useLocale();
  const signedIn = useAccount((s) => !!s.session);
  const addProposal = usePersonal((s) => s.addProposal);
  const path = usePathname();
  const refusal = useRefusal();
  const queries = useQueryClient();
  const [field, setField] = useState<CorrectionField>(fields[0]);
  const [who, setWho] = useState<number>(narrators?.[0]?.ordinal ?? 1);
  const [text, setText] = useState("");
  const [why, setWhy] = useState("");
  const [source, setSource] = useState("");
  const [state, setState] = useState<{ step: "write" | "sending" | "sent" | "kept" | "failed"; error?: string }>({ step: "write" });
  const ids = { field: useId(), who: useId(), text: useId(), why: useId(), source: useId() };
  if (state.step === "sent")
    return (
      <p className="text-[13px] text-good" role="status">
        {t("correctionSent")} <Link href="/review?filter=mine" className="underline underline-offset-2">{t("track")}</Link>
      </p>
    );
  if (state.step === "kept")
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-medium" role="status">{t("keptTitle")}</p>
        <SignInPanel returnTo={path} onClose={onDone} />
      </div>
    );
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const location = field === "narrator" ? String(who) : null;
    const sources = source.trim() ? [{ work: "other", ref: source.trim() }] : [];
    if (!signedIn) {
      // kept here, as written; sign-in is asked for now that the writing is done
      addProposal({ kind: "correction", slug: target, label, ordinal: null, at: location, field, href: path, current: "", text: text.trim(), why: why.trim(), sources });
      setState({ step: "kept" });
      return;
    }
    setState({ step: "sending" });
    try {
      await submit({ kind: "correction", lemma: target, field, location, text: text.trim(), why: why.trim(), sources });
      setState({ step: "sent" });
      void queries.invalidateQueries({ queryKey: ["corrections", target] });
      void queries.invalidateQueries({ queryKey: ["corrections-in-force"] });
      void queries.invalidateQueries({ queryKey: ["my-proposals"] });
    } catch (err) {
      setState({ step: "failed", error: refusal(err) });
    }
  }
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => void send(e)}>
      {fields.length > 1 && (
        <label className="flex flex-col gap-1 text-[12.5px]" htmlFor={ids.field}>
          {t("correctionWhat")}
          <select id={ids.field} className="field-input" value={field} onChange={(e) => setField(e.target.value as CorrectionField)}>
            {fields.map((f) => (
              <option key={f} value={f}>{t(`correctionField.${f}`)}</option>
            ))}
          </select>
        </label>
      )}
      {field === "narrator" && narrators && narrators.length > 0 && (
        <label className="flex flex-col gap-1 text-[12.5px]" htmlFor={ids.who}>
          {t("correctionWho")}
          <select id={ids.who} className="field-input" value={who} onChange={(e) => setWho(Number(e.target.value))} lang="ar">
            {narrators.map((n) => (
              <option key={n.ordinal} value={n.ordinal}>{`${formatNumber(n.ordinal, locale)}. ${n.text}`}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-[12.5px]" htmlFor={ids.text}>
        {t("correctionText")}
        <textarea id={ids.text} className="field-input min-h-[64px]" dir="auto" required maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]" htmlFor={ids.why}>
        {t("correctionWhy")}
        <textarea id={ids.why} className="field-input min-h-[52px]" dir="auto" required maxLength={4000} value={why} onChange={(e) => setWhy(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]" htmlFor={ids.source}>
        {t("correctionSource")}
        <input id={ids.source} className="field-input" dir="auto" maxLength={200} value={source} onChange={(e) => setSource(e.target.value)} />
      </label>
      {state.step === "failed" && <p className="text-[12.5px] text-bad" role="alert">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary min-h-[36px]" disabled={state.step === "sending" || !text.trim() || !why.trim()}>{t("correctionSend")}</button>
        <button type="button" className="btn min-h-[36px]" onClick={onDone}>{t("cancel")}</button>
      </div>
    </form>
  );
}
