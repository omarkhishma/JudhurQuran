import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileScreen } from "@/components/profile/ProfileScreen";
import { TABS, type Tab } from "@/lib/profile";

// the tab comes from the URL; everything shown comes from this browser and, signed in, the account
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/me">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("me.title"), robots: { index: false } };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/me">) {
  setRequestLocale((await params).locale);
  const tab = (await searchParams).tab;
  return <ProfileScreen initialTab={(TABS as readonly string[]).includes(String(tab)) ? (tab as Tab) : "contributions"} />;
}
