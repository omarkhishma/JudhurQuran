import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SavedView } from "@/components/saved/SavedView";

export async function generateMetadata({ params }: PageProps<"/[locale]/saved">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "saved" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SavedPage({ params }: PageProps<"/[locale]/saved">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SavedView />;
}
