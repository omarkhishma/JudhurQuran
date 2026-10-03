import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenSkeleton } from "@/components/shell/ScreenSkeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/split">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("split.title"), robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[locale]/split">) {
  setRequestLocale((await params).locale);
  return <ScreenSkeleton screen="split" phase="P8" />;
}
