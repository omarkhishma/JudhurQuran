import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LessonSheet } from "@/components/classroom/LessonSheet";

export async function generateMetadata({ params }: PageProps<"/[locale]/classroom/lesson/[id]/sheet">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("classroom.title"), robots: { index: false } };
}

/** A lesson on one printed sheet (B49): read in the browser, for its instructor or a member. */
export default async function Page({ params }: PageProps<"/[locale]/classroom/lesson/[id]/sheet">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <LessonSheet id={id} />;
}
