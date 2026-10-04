import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DataScreen } from "@/components/data/DataScreen";
import { JsonLd, datasetLd, type LdRelease } from "@/components/seo/JsonLd";
import { api } from "@/lib/api";
import { localized } from "@/lib/seo";

/** The latest recorded release, for the page's structured data; none until one is recorded (or the API is away). */
async function latest(): Promise<LdRelease | null> {
  try {
    const list = await api<{ data: { version: string }[] }>("/releases", {
      revalidate: 3600,
    });
    const v = list.data[0]?.version;
    return v
      ? await api<LdRelease>(`/releases/${v}`, { revalidate: 3600 })
      : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/data">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return {
    title: t("data.title"),
    description: t("data.lead"),
    alternates: localized(locale, "/data"),
  };
}

/** Data & API (P10.3): the dataset, its releases, the changelog, citing it, its sources — and the API playground
 * (`?tab=api`). Read in the browser from the public API. */
export default async function Page({ params }: PageProps<"/[locale]/data">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "dataset" });
  // the tab is read from the address in the browser; the page itself is built once, its description of the dataset
  // for search engines read again within the hour (B52)
  return (
    <>
      <JsonLd data={datasetLd(locale, await latest(), t("datasetLead"))} />
      <Suspense
        fallback={
          <div
            className="mx-auto my-6 h-64 w-full max-w-[1200px] animate-pulse rounded-xl bg-card-2"
            aria-hidden="true"
          />
        }
      >
        <DataScreen />
      </Suspense>
    </>
  );
}
