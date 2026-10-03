import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LibraryScreen, type TextCard } from "@/components/library/LibraryScreen";
import { api } from "@/lib/api";

export async function generateMetadata({ params }: PageProps<"/[locale]/library">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "library" });
  return { title: t("title"), robots: { index: false, follow: true } };
}

// `?add=1` opens the add-a-text sheet (LIB-37): read per request.
export const dynamic = "force-dynamic";

/** The Library (design 05 §5.1): the shelf from the text catalogue; the reader's own texts live in the browser. */
export default async function Page({ params, searchParams }: PageProps<"/[locale]/library">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const { data } = await api<{ data: TextCard[] }>("/texts");
  return <LibraryScreen texts={data} openAdd={sp.add === "1"} />;
}
