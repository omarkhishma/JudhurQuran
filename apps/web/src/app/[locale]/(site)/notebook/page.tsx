import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NotebookScreen } from "@/components/notebook/NotebookScreen";

// the tab and the note come from the URL; everything shown comes from this browser
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/notebook">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notebook" });
  return { title: t("title"), robots: { index: false } };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/notebook">) {
  setRequestLocale((await params).locale);
  const sp = await searchParams;
  const note = typeof sp.note === "string" && /^[\w:.-]{1,60}$/.test(sp.note) ? sp.note : null;
  return <NotebookScreen initialTab={sp.tab === "journal" ? "journal" : "notes"} initialNote={note} />;
}
