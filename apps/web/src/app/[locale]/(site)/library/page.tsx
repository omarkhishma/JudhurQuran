import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenSkeleton } from "@/components/shell/ScreenSkeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/library">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("library.title"), robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[locale]/library">) {
  setRequestLocale((await params).locale);
  return <ScreenSkeleton screen="library" phase="P4" />;
}
