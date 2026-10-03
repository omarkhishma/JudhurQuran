import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchScreen, type SearchPayload } from "@/components/search/SearchScreen";
import { api } from "@/lib/api";

export async function generateMetadata({ params }: PageProps<"/[locale]/search">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: t("pageTitle"), robots: { index: false, follow: true } };
}

// Results depend on the query string: rendered per request (the API search call itself is cached).
export const dynamic = "force-dynamic";

/** Search (design 05 §5.2): the first results render on the server for `?q=`, the rest live as you type. */
export default async function SearchPage({ params, searchParams }: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const s = (k: string, max: number) => (typeof sp[k] === "string" ? (sp[k] as string) : "").trim().slice(0, max);
  const q = s("q", 200);
  const initial = q ? await api<SearchPayload>(`/search?q=${encodeURIComponent(q)}&limit=30`, { revalidate: 3600 }) : null;
  // the kinds turned on and the root letters come back from the URL as they were left (SRC-31)
  return <SearchScreen initialQ={q} initial={initial} initialKinds={s("k", 80)} initialLetters={s("l", 12)} />;
}
