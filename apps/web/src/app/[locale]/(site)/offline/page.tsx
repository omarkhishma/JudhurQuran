import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OfflineList } from "@/components/shell/OfflineList";

export async function generateMetadata({ params }: PageProps<"/[locale]/offline">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return { title: t("offlineTitle"), robots: { index: false } };
}

/** What the offline worker shows when a page asked for is not kept and there is no connection (PLAN P12): said
 * plainly, with the pages this browser keeps for reading without one. */
export default async function OfflinePage({ params }: PageProps<"/[locale]/offline">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-12">
      <h1 className="text-[26px] font-semibold">{t("offlineTitle")}</h1>
      <p className="text-[14.5px] leading-relaxed text-t2">{t("offlineLead")}</p>
      <OfflineList />
    </div>
  );
}
