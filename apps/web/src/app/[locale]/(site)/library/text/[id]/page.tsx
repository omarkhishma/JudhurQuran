import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserTextReader } from "@/components/library/UserTextReader";

export async function generateMetadata({ params }: PageProps<"/[locale]/library/text/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "library" });
  return { title: t("myText"), robots: { index: false, follow: false } };
}

/** One of the reader's own texts: it lives in this browser only, so the page renders it there. */
export default async function Page({ params }: PageProps<"/[locale]/library/text/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <UserTextReader id={id} />;
}
