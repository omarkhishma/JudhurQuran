"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { SignInPanel } from "@/components/account/SignInPanel";
import { Link, usePathname } from "@/i18n/navigation";
import { ApiError, useAccount } from "@/lib/account/store";
import { type Kind, type Source, submit } from "@/lib/contrib";
import { getJSON } from "@/lib/reader/api";
import { type MorphKey, type SuggestTarget, usePersonal } from "@/lib/reader/store";
import { verseRef } from "@/lib/format";

const TITLE: Record<Kind, string> = { edit: "suggestTitle", sense: "proposeTitle", error: "errorTitle", gloss: "glossTitle", morphology: "morphTitle", attest: "attestTitle", entry: "entryTitle" };

/** The form's heading, which also names its dialog: "Suggest an edit · sense 02", "Propose a new sense"… */
export function useProposalHeading(): (kind: Kind, ordinal?: number | null) => string {
  const t = useTranslations("rd");
  const tc = useTranslations("contrib");
  return (kind, ordinal) => (kind === "edit" ? t("suggestTitle", { n: String(ordinal ?? 0).padStart(2, "0") }) : kind === "attest" || kind === "entry" ? tc(TITLE[kind]) : t(TITLE[kind]));
}
const VERSE = /^\d{1,3}:\d{1,3}$/;

/**
 * A proposal (RDR-311…325, RVQ-49…57, P7.1): the current text, the reader's wording, why — required — and its
 * sources, structured: the lexicons with the entry or page, a verse, a grammar's reference (RVQ-Q05). Signed in, it
 * goes to the queue; signed out, it is kept on this device and sign-in is asked for only now, after the writing,
 * never before (10 §4.4); the draft goes to the queue on sign-in. No form reaches the Quranic text (L1).
 * `kinds` lets a note propose in more than one way (NTB-Q07); a note's text is offered, never sent by itself.
 */
export function ProposalForm({ target, kinds, initialText, onClose }: { target: SuggestTarget; kinds?: Kind[]; initialText?: string; onClose: () => void }) {
  const t = useTranslations("rd");
  const tc = useTranslations("contrib");
  const locale = useLocale();
  const pathname = usePathname();
  const signedIn = useAccount((s) => !!s.session);
  const addProposal = usePersonal((s) => s.addProposal);
  const [kind, setKind] = useState<Kind>((kinds?.[0] as Kind) ?? (target.kind as Kind));
  const morph = kind === "morphology";
  const fields = target.fields ?? [];
  const [field, setField] = useState<MorphKey | "">(fields[0]?.key ?? "");
  const startsFromCurrent = kind === "edit" || kind === "gloss";
  const [text, setText] = useState(initialText ?? (startsFromCurrent ? target.current : ""));
  const [why, setWhy] = useState("");
  const [works, setWorks] = useState<string[]>([]);
  const [ref, setRef] = useState("");
  const [verse, setVerse] = useState("");
  const [grammar, setGrammar] = useState("");
  const [state, setState] = useState<{ step: "write" | "sending" | "sent" | "kept"; error?: string; id?: string }>({ step: "write" });
  const dicts = useQuery({ queryKey: ["dictionaries"], queryFn: () => getJSON<{ data: { key: string; name_ar: string; name_en: string }[] }>("/dictionaries"), staleTime: Infinity, enabled: !morph });
  const current = morph ? (fields.find((f) => f.key === field)?.value ?? "") : kind === "edit" || kind === "gloss" ? target.current : kind === "error" ? target.current : "";
  const sources: Source[] = [...works.map((w) => ({ work: w, ref: ref.trim() })), ...(VERSE.test(verse.trim()) ? [{ work: "quran", ref: verse.trim() }] : []), ...(grammar.trim() ? [{ work: "grammar", ref: grammar.trim() }] : [])];
  const valid = text.trim().length > 0 && why.trim().length > 0 && (!startsFromCurrent || text.trim() !== current.trim()) && (!morph || !!field) && (!verse.trim() || VERSE.test(verse.trim()));
  const heading = useProposalHeading()(kind, target.ordinal);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const body = { kind, slug: target.slug, label: target.label, ordinal: target.ordinal ?? null, at: target.at ?? null, field: morph && field ? field : null, current, text: text.trim(), why: why.trim(), sources };
    if (!signedIn) {
      // kept here, sources and all; sign-in is asked for now that the writing is done
      addProposal(body);
      setState({ step: "kept" });
      return;
    }
    setState({ step: "sending" });
    try {
      const p = await submit({ kind, lemma: target.slug, sense_ordinal: target.ordinal ?? null, location: target.at ?? null, field: body.field, current_text: current, text: body.text, why: body.why, sources });
      setState({ step: "sent", id: p.id });
    } catch (err) {
      setState({ step: "write", error: err instanceof ApiError ? (err.status === 429 ? tc("tooMany") : err.detail) : tc("failed") });
    }
  }

  if (state.step === "sent")
    return (
      <div className="flex flex-col gap-3 p-4" role="status">
        <h2 className="text-[15px] font-semibold">{tc("sentTitle")}</h2>
        <p className="text-[13px] leading-relaxed text-t2">{tc("sentBody")}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/review?filter=mine&id=${state.id}`} className="btn btn-primary min-h-[40px]" onClick={onClose}>
            {tc("track")}
          </Link>
          <button type="button" className="btn min-h-[40px]" onClick={onClose}>
            {tc("close")}
          </button>
        </div>
      </div>
    );
  if (state.step === "kept")
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[13.5px] font-medium" role="status">
          {tc("keptTitle")}
        </p>
        <SignInPanel returnTo={pathname} onClose={onClose} />
      </div>
    );

  return (
    <form className="flex flex-col gap-3 p-4" onSubmit={send}>
      <h2 className="text-[15px] font-semibold">{heading}</h2>
      {target.at && <p className="text-[12px] text-t3">{t("suggestAt", { word: target.label, ref: verseRef(target.at, locale) })}</p>}
      {kinds && kinds.length > 1 && (
        <label className="conc-select">
          <span>{tc("kindLabel")}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} data-autofocus>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {tc(`kind.${k}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      {morph && (
        <label className="conc-select">
          <span>{t("morphField")}</span>
          <select value={field} onChange={(e) => setField(e.target.value as MorphKey)} data-autofocus>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {t(f.key)}
              </option>
            ))}
          </select>
        </label>
      )}
      {current && (
        <div>
          <p className="label-caps">{t("current")}</p>
          <p className="mt-1 rounded-md bg-card-2 px-3 py-2 text-[13.5px]" dir="auto">
            {current}
          </p>
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="label-caps">{morph ? t("morphProposed") : kind === "attest" ? tc("attestWording") : t("yourWording")}</span>
        <textarea data-autofocus={morph || kinds ? undefined : true} value={text} onChange={(e) => setText(e.target.value)} rows={morph ? 2 : 3} className="field" dir="auto" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label-caps">
          {t("whySource")} <span className="text-bad">*</span>
        </span>
        <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder={morph ? t("morphWhyPlaceholder") : t("whyPlaceholder")} className="field min-h-[40px]" dir="auto" required />
      </label>
      {!morph && (
        <fieldset className="flex flex-col gap-2">
          <legend className="label-caps">{t("sources")}</legend>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={tc("lexicons")}>
            {(dicts.data?.data ?? []).map((d) => (
              <button key={d.key} type="button" className={"chip" + (works.includes(d.key) ? " is-on" : "")} aria-pressed={works.includes(d.key)} onClick={() => setWorks((s) => (s.includes(d.key) ? s.filter((x) => x !== d.key) : [...s, d.key]))}>
                {locale === "ar" ? d.name_ar : d.name_en}
              </button>
            ))}
          </div>
          {works.length > 0 && <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={tc("refPlaceholder")} aria-label={tc("ref")} className="field min-h-[40px]" dir="auto" />}
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={verse} onChange={(e) => setVerse(e.target.value)} placeholder={tc("versePlaceholder")} aria-label={tc("verse")} className="field min-h-[40px]" dir="ltr" inputMode="numeric" aria-invalid={!!verse.trim() && !VERSE.test(verse.trim())} />
            <input value={grammar} onChange={(e) => setGrammar(e.target.value)} placeholder={tc("grammarPlaceholder")} aria-label={tc("grammar")} className="field min-h-[40px]" dir="auto" />
          </div>
          {(kind === "edit" || kind === "sense" || kind === "gloss") && !sources.some((s) => s.work !== "grammar" || s.ref) && <p className="text-[11.5px] text-amber">{tc("needsSource")}</p>}
        </fieldset>
      )}
      {state.error && (
        <p className="text-[12.5px] text-bad" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn flex-1" onClick={onClose}>
          {t("cancel")}
        </button>
        <button type="submit" className={"btn flex-[2] " + (valid ? "btn-primary" : "")} disabled={!valid || state.step === "sending"}>
          {state.step === "sending" ? tc("sending") : t("submitForReview")}
        </button>
      </div>
      <p className="text-[11.5px] leading-relaxed text-t3">{[signedIn ? tc("footSigned") : tc("footLocal"), morph ? t("morphFootnote") : null, t("quranTextClosed")].filter(Boolean).join(" ")}</p>
    </form>
  );
}
