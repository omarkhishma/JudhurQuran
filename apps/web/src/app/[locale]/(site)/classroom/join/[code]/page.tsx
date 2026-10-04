import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JoinClass } from "@/components/classroom/JoinClass";

export async function generateMetadata({ params }: PageProps<"/[locale]/classroom/join/[code]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("classroom.title"), robots: { index: false } };
}

/** Joining a class by its link (P9.1): what the instructor will see, before anything is shared. */
export default async function Page({ params }: PageProps<"/[locale]/classroom/join/[code]">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  if (!/^[a-z0-9]{10}$/.test(code)) notFound();
  return <JoinClass code={code} />;
}
