import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AnalyseScreen } from "@/components/analyse/AnalyseScreen";
import { api } from "@/lib/api";
import { type Analysis, SAMPLE } from "@/lib/analyse";

export async function generateMetadata({ params }: PageProps<"/[locale]/analyse">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analyse" });
  return { title: t("pageTitle"), robots: { index: false, follow: true } };
}

// The phrase comes from the query string: rendered per request (the API call itself is cached).
export const dynamic = "force-dynamic";

/** The Analyser (design 05 §5.4): `?q=` prefilled, else the design's sample; the first analysis renders on the server. */
export default async function AnalysePage({ params, searchParams }: PageProps<"/[locale]/analyse">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : SAMPLE).slice(0, 600);
  const view = sp.view === "interlinear" ? "interlinear" : "table";
  const initial = q.trim() ? await api<Analysis>(`/analyse?q=${encodeURIComponent(q.trim())}`, { revalidate: 3600 }).catch(() => null) : null;
  return <AnalyseScreen initialQ={q} initialView={view} initial={initial} />;
}
