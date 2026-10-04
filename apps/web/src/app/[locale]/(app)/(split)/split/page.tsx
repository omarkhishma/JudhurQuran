import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SplitView } from "@/components/split/SplitView";

// read for each request: the sūra and the map come from the address
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/split">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "screens" });
  return { title: t("split.title"), robots: { index: false } };
}

/** The reader and a map side by side (P8.6): `?surah=` opens the reader there, `?map=` the map. */
export default async function SplitPage({ params, searchParams }: PageProps<"/[locale]/split">) {
  setRequestLocale((await params).locale);
  const q = await searchParams;
  const n = Number(typeof q.surah === "string" ? q.surah : 1);
  const surah = Number.isInteger(n) && n >= 1 && n <= 114 ? n : 1;
  const map = typeof q.map === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(q.map) ? q.map : null;
  return <SplitView surah={surah} map={map} />;
}
