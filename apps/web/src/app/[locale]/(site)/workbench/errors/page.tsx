import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OpsErrors } from "@/components/workbench/OpsErrors";

// read in the browser, fresh, behind the administrators' sign-in
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/workbench/errors">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ops" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<"/[locale]/workbench/errors">) {
  setRequestLocale((await params).locale);
  return <OpsErrors />;
}
