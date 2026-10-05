"use client";

import { isServer, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { buildSeedGraph, seedRows } from "@/lib/graph/seed";
import { encodeSeed, type Seed } from "@/lib/graph/seedCodec";
import { useMyGraphs } from "@/lib/graph/useMyGraphs";
import { KIND_COLOR } from "@/lib/graph/types";
import { useReader } from "@/lib/reader/store";


/** The editor's address for a seed: it builds the cards itself, so the link works in a new tab and when shared (RDR-369). */
export function seedHref(seed: Seed, into: string | null): string {
  const qs = new URLSearchParams({ s: encodeSeed(seed) });
  if (into) qs.set("into", into);
  return `/graph/seed?${qs}`;
}

/**
 * Hand off to the graph editor (design 03, RDR-361…370): what the seed will become, counted from the
 * cards the editor will really create (the prototype listed rows it never built, RDR-369/528), where to put
 * them — a new graph or one of the reader's graphs, nothing on it replaced — and the seed as JSON.
 */
export function GraphHandoff() {
  const seed = useReader((s) => s.handoff);
  const setHandoff = useReader((s) => s.setHandoff);
  if (!seed) return null;
  return <HandoffDialog key={JSON.stringify(seed)} seed={seed} onClose={() => setHandoff(null)} />;
}

/** The dialog itself, for a page with its own messages (the Notebook, NTB-22): `onToast` says what was done there. */
export function HandoffDialog({ seed, onClose, onToast }: { seed: Seed; onClose: () => void; onToast?: (text: string) => void }) {
  const t = useTranslations("rd");
  const locale = useLocale();
  const readerToast = useReader((s) => s.showToast);
  const showToast = onToast ?? readerToast;
  const [into, setInto] = useState<string>("");
  // a note is the reader's and may have changed since: read afresh each time; the rest is the dataset's
  const mine = seed.seed === "note";
  const built = useQuery({ queryKey: ["seed-graph", JSON.stringify(seed)], queryFn: () => buildSeedGraph(seed, locale), staleTime: mine ? 0 : 5 * 60_000, gcTime: isServer ? Infinity : mine ? 0 : 5 * 60_000 });
  const graphs = useMyGraphs();
  const rows = built.data ? seedRows(built.data) : [];

  async function copySeed() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(seed, null, 2));
      showToast(t("seedCopied"));
    } catch {
      showToast(t("copyFailed"));
    }
  }

  return (
    <Dialog open onClose={onClose} label={t("handoffTitle")} width={520}>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center">
          <h2 className="text-[15px] font-semibold">{t("handoffTitle")}</h2>
          <span className="flex-1" />
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t("close")}>✕</button>
        </div>
        <p className="text-[13px] text-t2">{t(`handoffSub_${seed.seed}`)}</p>
        <p className="label-caps">{t("handoffRows")}</p>
        {built.isLoading && <div className="h-24 animate-pulse rounded-lg bg-card-2" aria-busy />}
        {built.isError && <p className="text-[13px] text-bad" role="alert">{t("handoffError")}</p>}
        {built.data && (
          <ul className="handoff-rows">
            {rows.map((r) => (
              <li key={r.kind}>
                <span className="dot" style={{ background: KIND_COLOR[r.kind] }} />
                <span className="text-[12.5px] font-medium">{t(`graphKind_${r.kind}`)}</span>
                <span className="ar-classical min-w-0 flex-1 truncate text-[15px] text-t2" lang="ar" dir="rtl">{r.detail}</span>
                <span className="mono text-[11.5px] text-t3">{formatNumber(r.n, locale)}</span>
              </li>
            ))}
          </ul>
        )}
        <label className="conc-select">
          <span>{t("handoffInto")}</span>
          <select value={into} onChange={(e) => setInto(e.target.value)}>
            <option value="">{t("handoffNew")}</option>
            {graphs.data?.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </label>
        <p className="text-[11.5px] text-t3">{t("handoffFoot")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={() => void copySeed()}>{t("copySeed")}</button>
          <span className="flex-1" />
          <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
          <Link className="btn btn-primary" href={seedHref(seed, into || null)} data-autofocus>
            {t("openEditor")}
          </Link>
        </div>
      </div>
    </Dialog>
  );
}
