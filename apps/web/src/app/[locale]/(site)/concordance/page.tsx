import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenSkeleton } from "@/components/shell/ScreenSkeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/concordance">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("concordance.title"), robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[locale]/concordance">) {
  setRequestLocale((await params).locale);
  return <ScreenSkeleton screen="concordance" phase="P4" />;
}
