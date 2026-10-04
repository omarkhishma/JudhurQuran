"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cnt } from "@/lib/format";
import { publishedPath, type PublishedRow } from "@/lib/graph/publishedShared";

/** A published map as a list shows it (HUB-25, P8.5): its first root, its title and description, its author, when it
 * was last published, its cards and forks — in the gallery and on a root's pages (B60). The day in UTC, so the server's
 * page and the browser's say the same. */
export function PublishedCard({ m }: { m: PublishedRow }) {
  const t = useTranslations("graph");
  const locale = useLocale();
  const day = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(m.updated_at));
  return (
    <Link href={publishedPath(m.slug)} className="pub-row flex h-full flex-col gap-1.5 rounded-xl border border-line bg-card p-4 hover:border-line-2">
      <span className="flex items-baseline gap-2">
        {m.counts.lead && <span className="ar-classical text-[18px] text-t1" lang="ar">{m.counts.lead}</span>}
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold" dir="auto">{m.title}</span>
      </span>
      {m.description && <span className="line-clamp-2 text-[13px] leading-relaxed text-t2" dir="auto">{m.description}</span>}
      <span className="mt-auto text-[12px] text-t3">
        {[m.author.name ? t("publishedBy", { name: m.author.name }) : t("publishedAnonymousAr"), day, t("cards", cnt(m.counts.cards, locale)), t("publishedForks", cnt(m.fork_count, locale))].join(" · ")}
      </span>
    </Link>
  );
}
