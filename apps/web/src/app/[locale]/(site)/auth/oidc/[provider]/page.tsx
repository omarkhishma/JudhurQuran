import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OidcScreen } from "@/components/account/AuthScreens";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/auth/oidc/[provider]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("signIn"), robots: { index: false } };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/auth/oidc/[provider]">) {
  const { locale, provider } = await params;
  setRequestLocale(locale);
  if (provider !== "google" && provider !== "apple") notFound();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 2000) : null);
  return <OidcScreen provider={provider} code={one(sp.code)} state={one(sp.state)} error={one(sp.error)} />;
}
