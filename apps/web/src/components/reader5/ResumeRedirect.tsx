"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { getJSON } from "@/lib/reader/api";
import { usePersonal } from "@/lib/reader/store";
import type { WordPayload } from "@/lib/reader/types";

/**
 * /read (design 01 §1.3): opens the reader where it was left (the last sūra and verse read), or at
 * al-Fātiḥa on a first visit. Carries the reader's own parameters: ?w=slug (a cited word) goes to the
 * word's first place in the Quran; ?mode=ask|lookup|review and ?q= pass through.
 */
export function ResumeRedirect() {
  const t = useTranslations("rd");
  const router = useRouter();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const w = p.get("w");
    const keep = new URLSearchParams();
    for (const k of ["mode", "q"]) {
      const v = p.get(k);
      if (v) keep.set(k, v);
    }
    let cancelled = false;
    async function go() {
      if (w) {
        try {
          const word = await getJSON<WordPayload>(`/words/${encodeURIComponent(w)}?limit=1`);
          const first = word.attestations.items[0];
          if (first && !cancelled) {
            const [s, a] = first.verse_key.split(":");
            router.replace(`/quran/${s}?w=${encodeURIComponent(w)}&at=${first.location}#v${a}`);
            return;
          }
        } catch {
          // an unknown slug falls through to the reader with the word left for the panel to report
        }
        keep.set("w", w);
      }
      // a stored position is only trusted when it names a real sūra and verse: a stale or edited one
      // opens al-Fātiḥa instead of a missing page (RDR-538)
      const saved = usePersonal.getState().progress.quran;
      const prog = saved && Number.isInteger(saved.chapter) && saved.chapter >= 1 && saved.chapter <= 114 ? saved : null;
      const passage = prog && Number.isInteger(prog.passage) && prog.passage > 1 && prog.passage <= 286 ? prog.passage : null;
      const qs = keep.toString();
      if (cancelled) return;
      router.replace(`/quran/${prog?.chapter ?? 1}${qs ? `?${qs}` : ""}${passage && !qs ? `#v${passage}` : ""}`);
    }
    // the persisted store hydrates synchronously from localStorage; wait one frame for it to settle
    const id = requestAnimationFrame(() => void go());
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [router]);
  return (
    <p className="p-8 text-center text-[13px] text-t3" role="status">
      {t("loading")}
    </p>
  );
}
