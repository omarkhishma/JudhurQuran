import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DataScreen } from "@/components/data/DataScreen";
import { localized } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/data">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("data.title"), description: t("data.lead"), alternates: localized(locale, "/data") };
}

/** Data & API (P10.3): the dataset, its releases, the changelog, citing it, its sources — and the API playground
 * (`?tab=api`). Read in the browser from the public API. */
export default async function Page({ params }: PageProps<"/[locale]/data">) {
  setRequestLocale((await params).locale);
  // the tab is read from the address in the browser; the page itself is built once
  return (
    <Suspense fallback={<div className="mx-auto my-6 h-64 w-full max-w-[1200px] animate-pulse rounded-xl bg-card-2" aria-hidden="true" />}>
      <DataScreen />
    </Suspense>
  );
}
