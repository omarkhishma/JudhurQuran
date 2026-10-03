import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignInScreen } from "@/components/account/AuthScreens";

// where to return comes from the URL; nothing here is the same for two readers
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/signin">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("signIn"), robots: { index: false } };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/signin">) {
  setRequestLocale((await params).locale);
  const next = (await searchParams).next;
  // only a path inside the site (the API checks again)
  const safe = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next.slice(0, 300) : "/me";
  return <SignInScreen returnTo={safe} />;
}
