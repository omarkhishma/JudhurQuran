"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { REVIEW_BELOW } from "@/lib/analyse";
import { cnt, formatNumber } from "@/lib/format";
import { buildSeedGraph, NoteMissing, saveSeedGraph } from "@/lib/graph/seed";
import { decodeSeed, type Seed, type TrailSeedStep } from "@/lib/graph/seedCodec";
import { getJSON } from "@/lib/reader/api";
import type { WordPayload } from "@/lib/reader/types";

/**
 * Builds the cards a seed names from the current dataset, stores them in this browser — as a new graph or
 * added to the one named in `into` — and opens the editor on them. A link that carries no readable seed
 * says so and offers the editor's home. Words read from the reader's own text are reviewed first (F4).
 */
export function SeedImport({ encoded, into }: { encoded: string; into: string | null }) {
  const seed = decodeSeed(encoded);
  const review = seed?.seed === "trail" && seed.steps.some((s) => s.conf != null);
  const [chosen, setChosen] = useState<Seed | null>(null);
  if (seed && review && !chosen) return <ReviewReadings seed={seed as Extract<Seed, { seed: "trail" }>} onBuild={setChosen} />;
  return <Build seed={chosen ?? seed} into={into} />;
}

function Build({ seed, into }: { seed: Seed | null; into: string | null }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const router = useRouter();
  const job = useQuery({
    queryKey: ["seed-import", JSON.stringify(seed), into],
    enabled: !!seed,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const g = await buildSeedGraph(seed!, locale);
      const values = Object.fromEntries(Object.entries(g.title.values).map(([k, v]) => [k, typeof v === "number" ? formatNumber(v, locale) : v]));
      if (typeof g.title.values.count === "number") Object.assign(values, cnt(g.title.values.count, locale));
      return saveSeedGraph(g, t(g.title.key, values), into);
    },
  });
  useEffect(() => {
    if (!job.data) return;
    // a word's map remembers the word, for the editor's way back to the reader (EDT-020)
    const qs = seed?.seed === "word" ? `?${new URLSearchParams({ w: seed.slug, ...(seed.at ? { at: seed.at } : {}) })}` : "";
    router.replace(`/graph/edit/${job.data}${qs}`);
  }, [job.data, router, seed]);

  return (
    <div className="mx-auto flex max-w-[560px] flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      {!seed || job.isError ? (
        <>
          <p className="text-[15px] text-t1" role="alert">{t(!seed ? "seedUnreadable" : job.error instanceof NoteMissing ? "noteNotHere" : "seedFailed")}</p>
          <Link href="/graph" className="btn">{t("editorTitle")}</Link>
        </>
      ) : (
        <p className="text-[15px] text-t2" role="status" aria-live="polite">{t("seedBuilding")}</p>
      )}
    </div>
  );
}

type Row = { i: number; step: TrailSeedStep; word: WordPayload | null };

/**
 * The Analyser's readings of the reader's own text, before any enters a map (HWF-22, QAN-19, EDT-197): each with
 * the word as written, the reading and its confidence; those under REVIEW_BELOW amber and left out unless the
 * reader keeps them, and then marked on the map as readings.
 */
function ReviewReadings({ seed, onBuild }: { seed: Extract<Seed, { seed: "trail" }>; onBuild: (s: Seed) => void }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const words = useQuery({
    queryKey: ["seed-review", JSON.stringify(seed.steps)],
    staleTime: 5 * 60_000,
    queryFn: () =>
      Promise.all(
        seed.steps.map(async (step, i): Promise<Row> => ({ i, step, word: step.conf != null ? await getJSON<WordPayload>(`/words/${encodeURIComponent(step.id)}?limit=0`).catch(() => null) : null })),
      ),
  });
  const [keep, setKeep] = useState<Record<number, boolean>>(() => Object.fromEntries(seed.steps.map((s, i) => [i, s.conf == null || s.conf >= REVIEW_BELOW])));
  const rows = (words.data ?? []).filter((r) => r.step.conf != null);
  const conf = (x: number) => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);
  const unsure = rows.filter((r) => r.step.conf! < REVIEW_BELOW).length;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-3 px-4 py-10">
      <h1 className="text-[20px] font-semibold">{t("reviewTitle")}</h1>
      <p className="text-[14px] leading-relaxed text-t2">{t("reviewLead")}</p>
      {unsure > 0 && <p className="text-[13px] text-t2">{t("reviewUnsureCount", cnt(unsure, locale))}</p>}
      {words.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-card-2" aria-busy="true" />
      ) : (
        <ul className="seed-review" aria-label={t("reviewTitle")}>
          {rows.map((r) => {
            const low = r.step.conf! < REVIEW_BELOW;
            return (
              <li key={r.i} className={low ? "is-unsure" : undefined}>
                <label>
                  <input type="checkbox" checked={!!keep[r.i]} onChange={(e) => setKeep({ ...keep, [r.i]: e.target.checked })} />
                  <span className="ar-classical text-[18px]" lang="ar">{r.step.s ?? "—"}</span>
                  <span className="text-t3" aria-hidden="true">←</span>
                  <span className="min-w-0 flex-1">
                    <span className="ar-classical text-[18px]" lang="ar">{r.word?.ar.full ?? r.step.id}</span>
                    <span className="ms-2 text-[13px] text-root" lang="ar">{r.word?.root ? r.word.root.ar_spaced : t("noRoot")}</span>
                  </span>
                  <span className={"mono text-[12px] " + (low ? "text-amber" : "text-good")}>
                    {conf(r.step.conf!)}
                    {low && <span className="ms-1">{t("reviewUnsure")}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary min-h-[40px]"
          disabled={words.isPending}
          onClick={() => onBuild({ ...seed, steps: seed.steps.filter((_, i) => keep[i]) })}
        >
          {t("reviewBuild")}
        </button>
        <Link href={seed.phrase ? `/analyse?q=${encodeURIComponent(seed.phrase)}` : "/analyse"} className="btn min-h-[40px]">{t("reviewBack")}</Link>
      </div>
    </div>
  );
}
