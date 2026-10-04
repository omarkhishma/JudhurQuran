"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cnt } from "@/lib/format";
import type { PublishedRow } from "@/lib/graph/publishedShared";
import { getJSON } from "@/lib/reader/api";
import { PublishedCard } from "./PublishedCard";

/**
 * The published maps holding a root (B60), on its Quran and dictionary pages: the latest first, the way to all of
 * them in the gallery, and — where none is published yet — the way to draw the root's own map. Read in the browser:
 * the root's page is kept for a day, a map published or withdrawn a minute ago is not.
 */
export function RootMaps({ rootKey, spaced }: { rootKey: string; spaced: string }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const enc = encodeURIComponent(rootKey);
  const got = useQuery({ queryKey: ["root-maps", rootKey], queryFn: () => getJSON<{ data: PublishedRow[]; total: number }>(`/published?root=${enc}&limit=4`) });
  if (got.isError) return null;
  return (
    <section className="mt-8" aria-labelledby="root-maps-h" data-testid="root-maps">
      <h2 id="root-maps-h" className="mb-1 text-[17px] font-semibold">{t("rootMapsTitle")}</h2>
      {!got.data ? (
        <div className="h-20 animate-pulse rounded-xl bg-card-2" />
      ) : got.data.data.length ? (
        <>
          <p className="mb-3 text-[12.5px] text-t3">{t("rootMapsLead", { root: spaced, ...cnt(got.data.total, locale) })}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {got.data.data.map((m) => (
              <li key={m.slug}>
                <PublishedCard m={m} />
              </li>
            ))}
          </ul>
          {got.data.total > got.data.data.length && (
            <p className="mt-3">
              <Link href={`/g?root=${enc}`} className="btn">{t("rootMapsAll", cnt(got.data.total, locale))}</Link>
            </p>
          )}
        </>
      ) : (
        <p className="text-[13px] text-t2">
          {t("rootMapsNone")}{" "}
          <Link href={`/graph/root/${enc}`} className="text-ring hover:underline">{t("rootMapsDraw", { root: spaced })}</Link>
        </p>
      )}
    </section>
  );
}
