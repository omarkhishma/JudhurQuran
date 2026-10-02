import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ResumeRedirect } from "@/components/reader5/ResumeRedirect";

export const metadata: Metadata = { robots: { index: false } };

/** /read is the reader's own route (design 01 §1.3): it resumes where the reader stopped. */
export default async function ReadPage({ params }: PageProps<"/[locale]/read">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ResumeRedirect />;
}
