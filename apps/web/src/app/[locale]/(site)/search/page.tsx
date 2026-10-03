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
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 200);
  const initial = q ? await api<SearchPayload>(`/search?q=${encodeURIComponent(q)}&limit=30`, { revalidate: 3600 }) : null;
  return <SearchScreen initialQ={q} initial={initial} />;
}
