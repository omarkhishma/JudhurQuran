import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScreenSkeleton } from "@/components/shell/ScreenSkeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/review">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("review.title"), robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[locale]/review">) {
  setRequestLocale((await params).locale);
  return <ScreenSkeleton screen="review" phase="P7" />;
}
