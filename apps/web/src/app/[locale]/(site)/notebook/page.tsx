import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenSkeleton } from "@/components/shell/ScreenSkeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/notebook">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("notebook.title"), robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[locale]/notebook">) {
  setRequestLocale((await params).locale);
  return <ScreenSkeleton screen="notebook" phase="P5" />;
}
