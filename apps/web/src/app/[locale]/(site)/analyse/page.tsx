import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenSkeleton } from "@/components/shell/ScreenSkeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/analyse">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("analyse.title"), robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[locale]/analyse">) {
  setRequestLocale((await params).locale);
  return <ScreenSkeleton screen="analyse" phase="P4" />;
}
