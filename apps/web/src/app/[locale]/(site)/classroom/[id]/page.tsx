import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClassPage } from "@/components/classroom/ClassPage";

export async function generateMetadata({ params }: PageProps<"/[locale]/classroom/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("classroom.title"), robots: { index: false } };
}

/** A class (P9.1): read in the browser, for its instructor or a member. */
export default async function Page({ params }: PageProps<"/[locale]/classroom/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <ClassPage id={id} />;
}
