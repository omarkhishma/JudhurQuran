import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VerifyScreen } from "@/components/account/AuthScreens";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/auth/verify">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("signIn"), robots: { index: false } };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/auth/verify">) {
  setRequestLocale((await params).locale);
  const token = (await searchParams).token;
  return <VerifyScreen token={typeof token === "string" && /^[\w-]{20,100}$/.test(token) ? token : null} />;
}
