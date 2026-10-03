import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Changelog } from "@/components/contrib/Changelog";
import { ScreenSkeleton } from "@/components/shell/ScreenSkeleton";

export async function generateMetadata({ params }: PageProps<"/[locale]/data">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("data.title"), robots: { index: false } };
}

export default async function Page({ params }: PageProps<"/[locale]/data">) {
  setRequestLocale((await params).locale);
  // the downloads and the playground are P10; the changelog of contributions is live with P7 (DAT-17, RVQ-61)
  return (
    <>
      <ScreenSkeleton screen="data" phase="P10" />
      <div className="mx-auto w-full max-w-[1100px] px-4 pb-12">
        <Changelog />
      </div>
    </>
  );
}
