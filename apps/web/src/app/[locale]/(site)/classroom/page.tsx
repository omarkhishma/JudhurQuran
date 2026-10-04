import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClassroomHome } from "@/components/classroom/ClassroomHome";

export async function generateMetadata({ params }: PageProps<"/[locale]/classroom">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("classroom.title"), robots: { index: false } };
}

/** The classroom (P9): one reader's classes, read in the browser. */
export default async function Page({ params }: PageProps<"/[locale]/classroom">) {
  setRequestLocale((await params).locale);
  return <ClassroomHome />;
}
