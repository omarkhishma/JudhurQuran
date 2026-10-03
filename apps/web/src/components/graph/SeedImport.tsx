"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { buildSeedGraph, saveSeedGraph } from "@/lib/graph/seed";
import { decodeSeed } from "@/lib/graph/seedCodec";

/**
 * Builds the cards a seed names from the current dataset, stores them in this browser — as a new graph or
 * added to the one named in `into` — and opens the editor on them. A link that carries no readable seed
 * says so and offers the editor's home.
 */
export function SeedImport({ encoded, into }: { encoded: string; into: string | null }) {
  const t = useTranslations("graph");
  const router = useRouter();
  const seed = decodeSeed(encoded);
  const job = useQuery({
    queryKey: ["seed-import", encoded, into],
    enabled: !!seed,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const g = await buildSeedGraph(seed!);
      return saveSeedGraph(g, t(g.title.key, g.title.values), into);
    },
  });
  useEffect(() => {
    if (job.data) router.replace(`/graph/edit/${job.data}`);
  }, [job.data, router]);

  return (
    <div className="mx-auto flex max-w-[560px] flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      {!seed || job.isError ? (
        <>
          <p className="text-[15px] text-t1" role="alert">{t(seed ? "seedFailed" : "seedUnreadable")}</p>
          <Link href="/graph" className="btn">{t("editorTitle")}</Link>
        </>
      ) : (
        <p className="text-[15px] text-t2" role="status" aria-live="polite">{t("seedBuilding")}</p>
      )}
    </div>
  );
}
