import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LessonPage } from "@/components/classroom/LessonPage";

export async function generateMetadata({ params }: PageProps<"/[locale]/classroom/lesson/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("classroom.title"), robots: { index: false } };
}

/** A lesson (P9.2b): its instructor's view of how the class read it, or a member's own. Read in the browser. */
export default async function Page({ params }: PageProps<"/[locale]/classroom/lesson/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <LessonPage id={id} />;
}
