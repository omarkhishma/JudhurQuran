import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export type StatsTab = "stats" | "relations" | "mindmap" | "ask";

const TABS: { key: StatsTab; href: string; label: string }[] = [
  { key: "stats", href: "/stats", label: "tabStats" },
  { key: "relations", href: "/stats/relations", label: "tabRelations" },
  { key: "mindmap", href: "/mindmap", label: "tabMindmap" },
  { key: "ask", href: "/ask", label: "tabAsk" },
];

/**
 * The analysis surfaces of Phase 2 as one row of tabs (P16, P18): the Quran in numbers, patterns and relations, mind
 * maps, and «اسأل القرآن» — each reachable from the others, the one open marked as the current page.
 */
export async function StatsTabs({ current }: { current: StatsTab | null }) {
  const t = await getTranslations("stats");
  return (
    <nav className="stats-tabs" aria-label={t("tabsLabel")}>
      {TABS.map((x) => (
        <Link key={x.key} href={x.href} className="stats-tab" aria-current={x.key === current ? "page" : undefined}>
          {t(x.label)}
        </Link>
      ))}
    </nav>
  );
}
