import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GraphHome } from "@/components/graph/GraphHome";

export async function generateMetadata({ params }: PageProps<"/[locale]/graph">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "graph" });
  return { title: t("editorTitle"), description: t("editorLead") };
}

export default async function GraphHomePage({ params }: PageProps<"/[locale]/graph">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GraphHome />;
}
